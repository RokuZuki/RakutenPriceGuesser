import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users, Settings, Clock, Play, Link as LinkIcon, Crown, CheckCircle2, AlertCircle, Home, ShoppingCart, Loader2, Copy, Check } from 'lucide-react';

// --- Rakuten API Constants ---
const RAKUTEN_APP_ID = '45829ef2-6927-4d66-ad32-02e9b2bf3ab6';
const RAKUTEN_AFFILIATE_ID = '512f7071.24021527.512f7072.13b4d1f3';
const RAKUTEN_ACCESS_KEY = 'pk_cVhHUQ7wfo6evW4nFUckq4kZQKdGbxrn1Ume4NB7YaK';

// --- PeerJS Loader Hook ---
function usePeerJS() {
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        if (window.Peer) {
            setIsReady(true);
            return;
        }
        const script = document.createElement('script');
        script.src = "https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js";
        script.onload = () => setIsReady(true);
        document.body.appendChild(script);
    }, []);
    return isReady;
}

// --- Main App Component ---
export default function App() {
    const peerReady = usePeerJS();

    // App States
    const [playerName, setPlayerName] = useState('');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [currentRoomId, setCurrentRoomId] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isHost, setIsHost] = useState(false);

    // P2P States & Refs
    const peerRef = useRef(null);
    const connRef = useRef(null); // Guest's connection to host
    const hostConnectionsRef = useRef([]); // Host's connections to guests
    const myPeerIdRef = useRef(null);

    // Game State (Host owns this, Guests receive it)
    const initialGameState = {
        status: 'lobby', // lobby, playing, roundEnd, result
        settings: { genreId: '0', timeLimit: 30, rounds: 3 },
        currentRound: 0,
        products: [],
        players: {}, // { peerId: { name, score, currentGuess, hasGuessed, isHost } }
        roundEndTime: 0,
        nextRoundStartTime: 0
    };
    const [gameState, setGameState] = useState(initialGameState);
    const gameStateRef = useRef(initialGameState); // Ref for accurate access in callbacks

    // Custom Font Injection
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;700;900&display=swap');
      .font-pop { font-family: 'M PLUS Rounded 1c', sans-serif; }
      .box-shadow-pop { box-shadow: 4px 6px 0px rgba(185, 28, 28, 1); }
      .box-shadow-pop-sm { box-shadow: 2px 3px 0px rgba(185, 28, 28, 1); }
      .btn-pop:active { transform: translateY(4px); box-shadow: none !important; }
    `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    // --- Host Functions ---
    const updateGameState = (updater) => {
        setGameState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
            gameStateRef.current = next;
            // Broadcast to all connected guests
            hostConnectionsRef.current.forEach(conn => {
                if (conn.open) conn.send({ type: 'SYNC', state: next });
            });
            return next;
        });
    };

    const handleCreateRoom = () => {
        if (!playerName.trim()) return setError('名前を入力してください');
        setIsLoading(true);

        const newRoomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        const fullPeerId = `RKTN-${newRoomId}`;

        const peer = new window.Peer(fullPeerId);
        peerRef.current = peer;

        peer.on('open', (id) => {
            myPeerIdRef.current = id;
            setIsHost(true);
            setCurrentRoomId(newRoomId);
            setError('');
            setIsLoading(false);

            updateGameState({
                status: 'lobby',
                players: {
                    [id]: { name: playerName, score: 0, currentGuess: null, hasGuessed: false, isHost: true }
                }
            });
        });

        peer.on('connection', (conn) => {
            hostConnectionsRef.current.push(conn);

            conn.on('data', (data) => {
                if (data.type === 'JOIN') {
                    updateGameState(prev => ({
                        ...prev,
                        players: {
                            ...prev.players,
                            [conn.peer]: { name: data.name, score: 0, currentGuess: null, hasGuessed: false, isHost: false }
                        }
                    }));
                } else if (data.type === 'GUESS') {
                    updateGameState(prev => ({
                        ...prev,
                        players: {
                            ...prev.players,
                            [conn.peer]: { ...prev.players[conn.peer], currentGuess: data.guess, hasGuessed: true }
                        }
                    }));
                }
            });

            conn.on('close', () => {
                hostConnectionsRef.current = hostConnectionsRef.current.filter(c => c.peer !== conn.peer);
                updateGameState(prev => {
                    const newPlayers = { ...prev.players };
                    delete newPlayers[conn.peer];
                    return { ...prev, players: newPlayers };
                });
            });
        });

        peer.on('error', (err) => {
            setError('ルームの作成に失敗しました: ' + err.message);
            setIsLoading(false);
        });
    };

    // --- Guest Functions ---
    const handleJoinRoom = () => {
        if (!playerName.trim()) return setError('名前を入力してください');
        if (!roomIdInput.trim()) return setError('ルームIDを入力してください');
        setIsLoading(true);

        const upperRoomId = roomIdInput.toUpperCase();
        const hostPeerId = `RKTN-${upperRoomId}`;

        const peer = new window.Peer();
        peerRef.current = peer;

        peer.on('open', (id) => {
            myPeerIdRef.current = id;
            const conn = peer.connect(hostPeerId, { reliable: true });
            connRef.current = conn;

            conn.on('open', () => {
                conn.send({ type: 'JOIN', name: playerName });
                setIsHost(false);
                setCurrentRoomId(upperRoomId);
                setError('');
                setIsLoading(false);
            });

            conn.on('data', (data) => {
                if (data.type === 'SYNC') {
                    setGameState(data.state);
                    gameStateRef.current = data.state;
                }
            });

            conn.on('close', () => {
                setError('ホストとの接続が切断されました');
                setCurrentRoomId(null);
            });
        });

        peer.on('error', (err) => {
            setError('入室に失敗しました: ' + err.type);
            setIsLoading(false);
        });
    };

    // --- Game Logic (Host Only) ---
    const fetchProducts = async (genreId, rounds) => {
        const page = Math.floor(Math.random() * 3) + 1;
        const url = `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601?format=json&applicationId=${RAKUTEN_APP_ID}&affiliateId=${RAKUTEN_AFFILIATE_ID}&accessKey=${RAKUTEN_ACCESS_KEY}&page=${page}${genreId !== '0' ? `&genreId=${genreId}` : ''}`;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            const data = await res.json();

            let items = data.Items.map(i => {
                // 商品名から【】で囲まれた文字列を抽出し、記号を省いてタグとする
                const extractedTags = i.Item.itemName.match(/【.*?】/g) || [];
                const cleanTags = extractedTags.map(tag => tag.replace(/[【】]/g, ''));

                // 最大3枚までの画像URLを取得
                const images = i.Item.mediumImageUrls.slice(0, 3).map(img => img.imageUrl?.replace('?_ex=128x128', '')).filter(Boolean);

                return {
                    name: i.Item.itemName,
                    price: i.Item.itemPrice,
                    description: i.Item.itemCaption,
                    image: images[0] || '', // リザルト画面などで1枚だけ表示する用のフォールバック
                    images: images,
                    url: i.Item.affiliateUrl || i.Item.itemUrl,
                    tags: cleanTags
                };
            }).filter(i => i.image);

            return items.sort(() => 0.5 - Math.random()).slice(0, rounds);
        } catch (error) {
            console.warn("楽天APIの呼び出しに失敗したため、テスト用モックデータを使用します。", error);
            const fallbackProducts = [
                { name: "【送料無料】最高級黒毛和牛 焼肉セット 500g", price: 5980, description: "とろけるような食感の最高級黒毛和牛。", image: "https://placehold.co/400x400/ef4444/white?text=Wagyu+1", images: ["https://placehold.co/400x400/ef4444/white?text=Wagyu+1", "https://placehold.co/400x400/ef4444/white?text=Wagyu+2", "https://placehold.co/400x400/ef4444/white?text=Wagyu+3"], url: "https://www.rakuten.co.jp/", tags: ["送料無料"] },
                { name: "【ノイズキャンセリング機能付き】ワイヤレスイヤホン", price: 12800, description: "最新のノイズキャンセリング機能を搭載した高音質イヤホン。", image: "https://placehold.co/400x400/3b82f6/white?text=Earphone+1", images: ["https://placehold.co/400x400/3b82f6/white?text=Earphone+1", "https://placehold.co/400x400/3b82f6/white?text=Earphone+2", "https://placehold.co/400x400/3b82f6/white?text=Earphone+3"], url: "https://www.rakuten.co.jp/", tags: ["ノイズキャンセリング機能付き"] },
                { name: "【ギフト最適】京都抹茶スイーツ詰め合わせ", price: 3240, description: "老舗茶屋が作る濃厚抹茶スイーツの贅沢セット。", image: "https://placehold.co/400x400/10b981/white?text=Matcha+1", images: ["https://placehold.co/400x400/10b981/white?text=Matcha+1", "https://placehold.co/400x400/10b981/white?text=Matcha+2", "https://placehold.co/400x400/10b981/white?text=Matcha+3"], url: "https://www.rakuten.co.jp/", tags: ["ギフト最適"] },
                { name: "【自動ゴミ収集】ロボット掃除機 スマホ連動", price: 45000, description: "スマホアプリ連携で簡単お掃除。自動ゴミ収集機能付き。", image: "https://placehold.co/400x400/6b7280/white?text=Robot+1", images: ["https://placehold.co/400x400/6b7280/white?text=Robot+1", "https://placehold.co/400x400/6b7280/white?text=Robot+2", "https://placehold.co/400x400/6b7280/white?text=Robot+3"], url: "https://www.rakuten.co.jp/", tags: ["自動ゴミ収集"] },
                { name: "【まとめ買い】天然水 ミネラルウォーター 500ml×24本", price: 1980, description: "大自然で育まれた美味しい天然水。", image: "https://placehold.co/400x400/0ea5e9/white?text=Water+1", images: ["https://placehold.co/400x400/0ea5e9/white?text=Water+1", "https://placehold.co/400x400/0ea5e9/white?text=Water+2", "https://placehold.co/400x400/0ea5e9/white?text=Water+3"], url: "https://www.rakuten.co.jp/", tags: ["まとめ買い"] }
            ];

            let items = [];
            for (let i = 0; i < rounds; i++) {
                items.push(fallbackProducts[i % fallbackProducts.length]);
            }
            return items.sort(() => 0.5 - Math.random());
        }
    };

    // Host Game Loop
    useEffect(() => {
        if (!isHost) return;

        const interval = setInterval(() => {
            const state = gameStateRef.current;

            if (state.status === 'playing') {
                const remaining = state.roundEndTime - Date.now();
                const playersArr = Object.values(state.players);
                const allGuessed = playersArr.length > 0 && playersArr.every(p => p.hasGuessed);

                if (remaining <= 0 || allGuessed) {
                    const currentProduct = state.products[state.currentRound];
                    const newPlayers = { ...state.players };

                    Object.keys(newPlayers).forEach(id => {
                        const p = newPlayers[id];
                        let points = 0;
                        if (p.hasGuessed && p.currentGuess) {
                            const diff = Math.abs(p.currentGuess - currentProduct.price);
                            const percentOff = diff / currentProduct.price;
                            points = Math.max(0, Math.floor((1 - percentOff) * 1000));
                        }
                        newPlayers[id] = { ...p, score: p.score + points, lastPoints: points };
                    });

                    updateGameState({
                        status: 'roundEnd',
                        players: newPlayers,
                        nextRoundStartTime: Date.now() + 8000
                    });
                }
            } else if (state.status === 'roundEnd') {
                const remaining = state.nextRoundStartTime - Date.now();
                if (remaining <= 0) {
                    if (state.currentRound >= state.settings.rounds - 1) {
                        updateGameState({ status: 'result' });
                    } else {
                        const resetPlayers = {};
                        Object.keys(state.players).forEach(id => {
                            resetPlayers[id] = { ...state.players[id], currentGuess: null, hasGuessed: false };
                        });

                        updateGameState({
                            status: 'playing',
                            currentRound: state.currentRound + 1,
                            roundEndTime: Date.now() + (state.settings.timeLimit * 1000) + 2000,
                            players: resetPlayers
                        });
                    }
                }
            }
        }, 500);

        return () => clearInterval(interval);
    }, [isHost]);

    const submitGuess = (guessValue) => {
        const val = parseInt(guessValue, 10);
        if (isNaN(val)) return;

        if (isHost) {
            updateGameState(prev => ({
                ...prev,
                players: {
                    ...prev.players,
                    [myPeerIdRef.current]: { ...prev.players[myPeerIdRef.current], currentGuess: val, hasGuessed: true }
                }
            }));
        } else if (connRef.current && connRef.current.open) {
            connRef.current.send({ type: 'GUESS', guess: val });
        }
    };

    if (!peerReady) {
        return <div className="flex flex-col justify-center items-center h-screen bg-[#FFFBEB] font-pop text-red-500 gap-4"><Loader2 className="w-12 h-12 animate-spin" /><p className="font-bold text-xl">通信準備中...</p></div>;
    }

    return (
        <div className="min-h-screen bg-[#FFFBEB] font-pop text-gray-800 p-4 md:p-8 flex flex-col items-center">
            <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#EF4444 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>

            <div className="w-full max-w-4xl relative z-10">
                {!currentRoomId ? (
                    <TitleScreen
                        playerName={playerName} setPlayerName={setPlayerName}
                        roomIdInput={roomIdInput} setRoomIdInput={setRoomIdInput}
                        handleCreateRoom={handleCreateRoom} handleJoinRoom={handleJoinRoom}
                        error={error} isLoading={isLoading}
                    />
                ) : gameState.status === 'lobby' ? (
                    <LobbyScreen
                        gameState={gameState} isHost={isHost} roomId={currentRoomId}
                        myPeerId={myPeerIdRef.current}
                        updateSetting={(k, v) => updateGameState(prev => ({ ...prev, settings: { ...prev.settings, [k]: v } }))}
                        startGame={async () => {
                            setIsLoading(true);
                            try {
                                const products = await fetchProducts(gameState.settings.genreId, gameState.settings.rounds);
                                updateGameState({
                                    status: 'playing',
                                    products,
                                    currentRound: 0,
                                    roundEndTime: Date.now() + (gameState.settings.timeLimit * 1000) + 2000
                                });
                            } catch (e) { alert("商品の取得に失敗しました"); }
                            setIsLoading(false);
                        }}
                        isLoading={isLoading}
                    />
                ) : gameState.status === 'playing' ? (
                    <GameScreen gameState={gameState} myPeerId={myPeerIdRef.current} submitGuess={submitGuess} />
                ) : gameState.status === 'roundEnd' ? (
                    <RoundEndScreen gameState={gameState} myPeerId={myPeerIdRef.current} />
                ) : gameState.status === 'result' ? (
                    <ResultScreen gameState={gameState} />
                ) : null}
            </div>
        </div>
    );
}

// --- UI Components ---

function TitleScreen({ playerName, setPlayerName, roomIdInput, setRoomIdInput, handleCreateRoom, handleJoinRoom, error, isLoading }) {
    return (
        <div className="flex flex-col items-center justify-center mt-12 space-y-8">
            <div className="text-center space-y-4">
                <div className="inline-block bg-white border-4 border-red-500 rounded-3xl p-6 box-shadow-pop transform rotate-[-2deg]">
                    <h1 className="text-4xl md:text-6xl font-black text-red-500 tracking-tight flex items-center gap-3">
                        <ShoppingCart className="w-10 h-10 md:w-14 md:h-14" />
                        楽天プライスゲッサー
                    </h1>
                </div>
                <p className="text-lg font-bold text-gray-600">商品の値段をピッタリ当てろ！ <span className="text-xs bg-gray-200 px-2 py-1 rounded">P2P通信版</span></p>
            </div>

            <div className="bg-white border-4 border-red-500 rounded-2xl p-8 box-shadow-pop w-full max-w-md space-y-6">
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 shrink-0" /> <span className="text-sm font-bold">{error}</span>
                    </div>
                )}

                <div>
                    <label className="block text-gray-700 font-bold mb-2">ニックネーム</label>
                    <input
                        type="text" maxLength={10} placeholder="名前を入力"
                        className="w-full border-4 border-gray-300 rounded-xl px-4 py-3 text-xl focus:border-red-500 focus:outline-none transition-colors"
                        value={playerName} onChange={(e) => setPlayerName(e.target.value)}
                    />
                </div>

                <div className="pt-4 border-t-4 border-dashed border-gray-200">
                    <button
                        onClick={handleCreateRoom} disabled={isLoading}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl text-xl btn-pop box-shadow-pop-sm flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Home className="w-6 h-6" /> 部屋を作る</>}
                    </button>
                </div>

                <div className="pt-4 border-t-4 border-dashed border-gray-200 flex gap-2">
                    <input
                        type="text" maxLength={5} placeholder="ルームID"
                        className="w-1/2 border-4 border-gray-300 rounded-xl px-4 py-3 text-xl focus:border-red-500 focus:outline-none uppercase text-center font-bold tracking-widest"
                        value={roomIdInput} onChange={(e) => setRoomIdInput(e.target.value)}
                    />
                    <button
                        onClick={handleJoinRoom} disabled={isLoading}
                        className="w-1/2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl text-lg btn-pop box-shadow-pop-sm flex justify-center items-center"
                    >
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : '部屋に入る'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function LobbyScreen({ gameState, isHost, roomId, myPeerId, updateSetting, startGame, isLoading }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        // iframe環境下でも確実にコピーするための処理
        const textArea = document.createElement("textarea");
        textArea.value = roomId;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed', err);
        }
        document.body.removeChild(textArea);
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 mt-6">
            <div className="flex-1 bg-white border-4 border-red-500 rounded-2xl p-6 box-shadow-pop">
                <div className="flex justify-between items-center mb-6 pb-4 border-b-4 border-dashed border-gray-200">
                    <h2 className="text-3xl font-black text-red-500 flex items-center gap-2">
                        <Users className="w-8 h-8" /> 参加者
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="bg-red-100 border-2 border-red-500 text-red-700 px-4 py-2 rounded-xl font-bold text-lg tracking-widest">
                            ID: {roomId}
                        </div>
                        <button
                            onClick={handleCopy}
                            className={`p-2 rounded-xl border-2 transition-all ${copied ? 'bg-green-500 border-green-700 text-white' : 'bg-red-500 hover:bg-red-600 border-red-700 text-white'}`}
                            title="ルームIDをコピー"
                        >
                            {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    {Object.entries(gameState.players).map(([id, p]) => (
                        <div key={id} className="flex items-center gap-3 bg-gray-50 border-2 border-gray-200 p-3 rounded-xl">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${id === myPeerId ? 'bg-red-500' : 'bg-gray-400'}`}>
                                {p.name.charAt(0)}
                            </div>
                            <span className="text-xl font-bold flex-1">{p.name}</span>
                            {p.isHost && <Crown className="text-yellow-500 w-6 h-6" />}
                        </div>
                    ))}
                </div>
                <p className="mt-6 text-sm text-gray-500 font-bold text-center">※ 1人でも遊ぶことができます</p>
            </div>

            <div className="flex-1 bg-white border-4 border-blue-500 rounded-2xl p-6 shadow-[4px_6px_0px_rgba(59,130,246,1)] flex flex-col">
                <h2 className="text-3xl font-black text-blue-500 mb-6 flex items-center gap-2 pb-4 border-b-4 border-dashed border-gray-200">
                    <Settings className="w-8 h-8" /> 設定
                </h2>

                <div className="space-y-6 flex-1">
                    <div>
                        <label className="block text-gray-700 font-bold mb-2">ジャンル</label>
                        <select
                            disabled={!isHost}
                            className="w-full border-4 border-gray-300 rounded-xl px-4 py-3 text-lg focus:border-blue-500 bg-white"
                            value={gameState.settings.genreId} onChange={(e) => updateSetting('genreId', e.target.value)}
                        >
                            <option value="0">すべてのジャンル</option>
                            <option value="100227">食品・スイーツ</option>
                            <option value="100371">レディースファッション</option>
                            <option value="562637">家電</option>
                            <option value="101240">CD・DVD</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-700 font-bold mb-2">ラウンド数</label>
                        <div className="flex gap-2">
                            {[3, 5, 10].map(r => (
                                <button key={r} disabled={!isHost} onClick={() => updateSetting('rounds', r)}
                                    className={`flex-1 py-2 rounded-xl border-4 font-bold text-lg transition-colors ${gameState.settings.rounds === r ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 text-gray-500'}`}
                                >{r}回</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-gray-700 font-bold mb-2">制限時間</label>
                        <div className="flex gap-2">
                            {[15, 30, 60].map(t => (
                                <button key={t} disabled={!isHost} onClick={() => updateSetting('timeLimit', t)}
                                    className={`flex-1 py-2 rounded-xl border-4 font-bold text-lg transition-colors ${gameState.settings.timeLimit === t ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 text-gray-500'}`}
                                >{t}秒</button>
                            ))}
                        </div>
                    </div>
                </div>

                {isHost ? (
                    <button
                        onClick={startGame} disabled={isLoading || Object.keys(gameState.players).length < 1}
                        className="w-full mt-8 bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl text-xl transition-all shadow-[0px_4px_0px_#1d4ed8] active:shadow-none active:translate-y-[4px] flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Play className="w-6 h-6 fill-current" /> ゲーム開始</>}
                    </button>
                ) : (
                    <div className="w-full mt-8 bg-gray-200 text-gray-500 font-bold py-4 rounded-xl text-xl text-center border-4 border-gray-300">
                        ホストの開始を待っています...
                    </div>
                )}
            </div>
        </div>
    );
}

function GameScreen({ gameState, myPeerId, submitGuess }) {
    const [guessInput, setGuessInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(gameState.settings.timeLimit);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0); // 選択されている画像のインデックス

    const me = gameState.players[myPeerId];
    const currentProduct = gameState.products[gameState.currentRound];
    const displayImages = currentProduct?.images && currentProduct.images.length > 0 ? currentProduct.images : [currentProduct?.image];

    // ラウンドが変わるたびに画像インデックスをリセット
    useEffect(() => {
        setSelectedImageIndex(0);
    }, [gameState.currentRound]);

    // Local Timer display
    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(Math.max(0, Math.ceil((gameState.roundEndTime - Date.now()) / 1000)));
        }, 200);
        return () => clearInterval(interval);
    }, [gameState.roundEndTime]);

    const onSubmit = (e) => {
        e.preventDefault();
        if (guessInput) submitGuess(guessInput);
    };

    if (!currentProduct) return null;

    return (
        <div className="mt-4 flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-4 px-2">
                <div className="bg-red-500 text-white font-black text-xl px-4 py-2 rounded-xl border-4 border-red-700 box-shadow-pop-sm">
                    Round {gameState.currentRound + 1} <span className="text-red-200 text-sm">/ {gameState.settings.rounds}</span>
                </div>
                <div className={`font-black text-3xl flex items-center gap-2 ${timeLeft <= 5 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
                    <Clock className="w-8 h-8" /> {timeLeft}秒
                </div>
            </div>

            <div className="w-full bg-white border-4 border-red-500 rounded-3xl p-6 box-shadow-pop flex flex-col md:flex-row gap-6 items-center md:items-start mb-6">
                <div className="w-full md:w-1/2 flex flex-col items-center gap-4">

                    {/* メインの大きい画像 */}
                    <div className="w-64 h-64 md:w-80 md:h-80 bg-gray-100 rounded-2xl border-4 border-gray-200 flex items-center justify-center overflow-hidden">
                        <img src={displayImages[selectedImageIndex]} className="max-w-full max-h-full object-contain transition-opacity duration-300" />
                    </div>

                    {/* サムネイル一覧（画像が複数ある場合のみ表示） */}
                    {displayImages.length > 1 && (
                        <div className="flex flex-row justify-center items-center gap-3 w-full">
                            {displayImages.map((img, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setSelectedImageIndex(i)}
                                    className={`w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden border-2 transition-all hover:opacity-80 ${selectedImageIndex === i ? 'border-red-500 shadow-[2px_3px_0px_rgba(185,28,28,1)] transform -translate-y-1' : 'border-gray-200'}`}
                                >
                                    <img src={img} className="max-w-full max-h-full object-contain" />
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                        {currentProduct.tags.map((tag, i) => (
                            <span key={i} className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md">{tag}</span>
                        ))}
                    </div>
                </div>

                <div className="w-full md:w-1/2 flex flex-col gap-4">
                    <h3 className="text-xl md:text-2xl font-bold leading-snug">{currentProduct.name}</h3>
                    <p className="text-sm text-gray-500 line-clamp-4 bg-gray-50 p-3 rounded-xl border-2 border-gray-100">{currentProduct.description}</p>
                </div>
            </div>

            <div className="w-full max-w-2xl bg-white border-4 border-gray-300 rounded-2xl p-6 box-shadow-pop-sm">
                {me?.hasGuessed ? (
                    <div className="text-center py-6">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-gray-700">予想完了！</h3>
                        <p className="text-gray-500 mt-2">
                            {Object.keys(gameState.players).length > 1 ? "他のプレイヤーを待っています..." : "まもなく正解発表です..."}
                        </p>
                        <div className="mt-4 flex gap-2 justify-center">
                            {Object.values(gameState.players).map((p, i) => (
                                <div key={i} className={`w-3 h-3 rounded-full ${p.hasGuessed ? 'bg-green-500' : 'bg-gray-300 animate-bounce'}`} style={{ animationDelay: `${i * 0.1}s` }}></div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="flex flex-col gap-4">
                        <label className="text-center text-xl font-bold text-gray-700">ズバリ、いくら？</label>
                        <div className="flex items-center gap-3">
                            <span className="text-4xl font-black text-gray-400">¥</span>
                            <input
                                type="number" autoFocus placeholder="1000"
                                className="flex-1 border-4 border-gray-300 rounded-xl px-4 py-4 text-3xl font-bold focus:border-red-500 focus:outline-none text-right"
                                value={guessInput} onChange={(e) => setGuessInput(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit" disabled={!guessInput}
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl text-2xl btn-pop box-shadow-pop-sm disabled:opacity-50 mt-2"
                        >決定！</button>
                    </form>
                )}
            </div>
        </div>
    );
}

function RoundEndScreen({ gameState, myPeerId }) {
    const currentProduct = gameState.products[gameState.currentRound];
    const sortedPlayers = Object.entries(gameState.players).sort((a, b) => b[1].lastPoints - a[1].lastPoints);

    return (
        <div className="mt-8 flex flex-col items-center">
            <h2 className="text-4xl font-black text-red-500 mb-6 bg-white px-8 py-3 rounded-2xl border-4 border-red-500 box-shadow-pop transform -rotate-1">
                正解発表
            </h2>

            <div className="w-full max-w-2xl bg-white border-4 border-red-500 rounded-3xl p-8 box-shadow-pop text-center relative overflow-hidden mb-8">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-yellow-400 to-red-500"></div>
                <img src={currentProduct.image} className="w-32 h-32 object-contain mx-auto mb-4 border-4 border-gray-100 rounded-xl" />
                <h3 className="text-xl font-bold mb-4 line-clamp-2">{currentProduct.name}</h3>
                <p className="text-gray-500 font-bold">正解は...</p>
                <div className="text-6xl font-black text-red-600 my-4">
                    ¥{currentProduct.price.toLocaleString()}
                </div>
            </div>

            <div className="w-full max-w-2xl space-y-3">
                {sortedPlayers.map(([id, p], index) => {
                    const diff = p.currentGuess ? Math.abs(p.currentGuess - currentProduct.price) : null;
                    return (
                        <div key={id} className={`flex items-center gap-4 bg-white border-4 rounded-2xl p-4 ${id === myPeerId ? 'border-red-500 box-shadow-pop-sm' : 'border-gray-200'}`}>
                            <div className="w-8 font-black text-gray-400 text-xl">{index + 1}</div>
                            <div className="flex-1">
                                <div className="font-bold text-lg">{p.name}</div>
                                <div className="text-sm text-gray-500">
                                    予想: {p.hasGuessed ? `¥${p.currentGuess.toLocaleString()}` : '時間切れ'}
                                    {p.hasGuessed && <span className="ml-2 text-xs">(誤差 ¥{diff.toLocaleString()})</span>}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-black text-2xl text-green-500">+{p.lastPoints} <span className="text-sm">pt</span></div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="mt-8 font-bold text-gray-500 animate-pulse">次のラウンドへ進みます...</p>
        </div>
    );
}

function ResultScreen({ gameState }) {
    const sortedPlayers = Object.entries(gameState.players).sort((a, b) => b[1].score - a[1].score);

    return (
        <div className="mt-8 flex flex-col items-center pb-12">
            <h2 className="text-5xl font-black text-yellow-500 mb-8 flex items-center gap-3 bg-white px-8 py-4 rounded-3xl border-4 border-yellow-400 shadow-[4px_6px_0px_#eab308]">
                <Trophy className="w-12 h-12" /> 最終結果
            </h2>

            <div className="w-full max-w-3xl flex flex-col gap-4 mb-12">
                {sortedPlayers.map(([id, p], index) => (
                    <div key={id} className={`flex items-center gap-6 bg-white border-4 rounded-2xl p-6 ${index === 0 ? 'border-yellow-400 bg-yellow-50 transform scale-105 shadow-[4px_6px_0px_#eab308] z-10' : 'border-gray-300'}`}>
                        <div className={`w-12 h-12 flex items-center justify-center rounded-full font-black text-2xl text-white ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>
                            {index + 1}
                        </div>
                        <div className="flex-1 text-2xl font-bold">{p.name}</div>
                        <div className="text-3xl font-black text-red-500">{p.score} <span className="text-xl">pt</span></div>
                    </div>
                ))}
            </div>

            <div className="w-full max-w-3xl">
                <h3 className="text-2xl font-black text-gray-700 mb-6 text-center border-b-4 border-dashed border-gray-300 pb-2">登場した商品</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {gameState.products.map((prod, i) => (
                        <div key={i} className="bg-white border-4 border-gray-200 rounded-2xl p-4 flex flex-col gap-3 hover:border-red-400 transition-colors">
                            <div className="flex gap-4">
                                <img src={prod.image} className="w-20 h-20 object-contain rounded-lg border-2 border-gray-100" />
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm line-clamp-2 leading-tight">{prod.name}</h4>
                                    <p className="text-red-600 font-black mt-1">¥{prod.price.toLocaleString()}</p>
                                </div>
                            </div>
                            <a
                                href={prod.url} target="_blank" rel="noopener noreferrer"
                                className="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold py-2 rounded-lg flex justify-center items-center gap-2 border-2 border-orange-200 transition-colors"
                            >
                                <LinkIcon className="w-4 h-4" /> 楽天市場で見る
                            </a>
                        </div>
                    ))}
                </div>
            </div>

            <button
                onClick={() => window.location.reload()}
                className="mt-12 bg-gray-800 hover:bg-gray-900 text-white font-bold py-4 px-12 rounded-xl text-xl btn-pop shadow-[0px_4px_0px_#1f2937]"
            >
                タイトルへ戻る
            </button>
        </div>
    );
}