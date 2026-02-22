import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection } from 'firebase/firestore';
import { Trophy, Users, Settings, Clock, Play, Link as LinkIcon, Crown, CheckCircle2, AlertCircle, Home, ShoppingCart } from 'lucide-react';

// --- Firebase Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'rakuten-price-guesser';

// --- Rakuten API Constants ---
const RAKUTEN_APP_ID = '45829ef2-6927-4d66-ad32-02e9b2bf3ab6';
const RAKUTEN_AFFILIATE_ID = '512f7071.24021527.512f7072.13b4d1f3';

// --- Main App Component ---
export default function App() {
    const [user, setUser] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [currentRoomId, setCurrentRoomId] = useState(null);
    const [room, setRoom] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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

    // Auth Effect
    useEffect(() => {
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (e) {
                console.error("Auth error:", e);
            }
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);

    // Room Subscription Effect
    useEffect(() => {
        if (!user || !currentRoomId) return;

        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', currentRoomId);
        const unsubscribe = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                setRoom(docSnap.data());
            } else {
                setError('ルームが見つかりません');
                setCurrentRoomId(null);
            }
        }, (err) => {
            console.error(err);
            setError('通信エラーが発生しました');
        });

        return () => unsubscribe();
    }, [user, currentRoomId]);

    const generateRoomId = () => Math.random().toString(36).substring(2, 7).toUpperCase();

    const handleCreateRoom = async () => {
        if (!playerName.trim()) return setError('名前を入力してください');
        if (!user) return;

        setIsLoading(true);
        const newRoomId = generateRoomId();
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newRoomId);

        try {
            await setDoc(roomRef, {
                roomId: newRoomId,
                hostId: user.uid,
                status: 'lobby', // lobby, playing, roundEnd, result
                settings: {
                    genreId: '0', // 0=すべてのジャンル
                    timeLimit: 30, // seconds
                    rounds: 3
                },
                currentRound: 0,
                products: [],
                players: {
                    [user.uid]: { name: playerName, score: 0, currentGuess: null, hasGuessed: false }
                }
            });
            setCurrentRoomId(newRoomId);
            setError('');
        } catch (e) {
            setError('ルームの作成に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!playerName.trim()) return setError('名前を入力してください');
        if (!roomIdInput.trim()) return setError('ルームIDを入力してください');
        if (!user) return;

        setIsLoading(true);
        const upperRoomId = roomIdInput.toUpperCase();
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', upperRoomId);

        try {
            const docSnap = await getDoc(roomRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.status !== 'lobby') {
                    setError('すでにゲームが開始されています');
                    setIsLoading(false);
                    return;
                }
                await updateDoc(roomRef, {
                    [`players.${user.uid}`]: { name: playerName, score: 0, currentGuess: null, hasGuessed: false }
                });
                setCurrentRoomId(upperRoomId);
                setError('');
            } else {
                setError('ルームが存在しません');
            }
        } catch (e) {
            setError('入室に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchProducts = async (genreId, rounds) => {
        // ページ数が大きすぎるとエラーになることがあるため、1〜3ページから取得
        const page = Math.floor(Math.random() * 3) + 1;
        const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220601?format=json&applicationId=${RAKUTEN_APP_ID}&affiliateId=${RAKUTEN_AFFILIATE_ID}&page=${page}${genreId !== '0' ? `&genreId=${genreId}` : ''}`;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            const data = await res.json();

            // Shuffle and pick top N
            let items = data.Items.map(i => ({
                name: i.Item.itemName,
                price: i.Item.itemPrice,
                description: i.Item.itemCaption,
                image: i.Item.mediumImageUrls[0]?.imageUrl?.replace('?_ex=128x128', '') || '',
                url: i.Item.affiliateUrl || i.Item.itemUrl,
                tags: i.Item.itemName.match(/【.*?】/g) || [] // Extract text in brackets as tags
            })).filter(i => i.image);

            return items.sort(() => 0.5 - Math.random()).slice(0, rounds);
        } catch (error) {
            console.warn("楽天APIの呼び出しに失敗したため、テスト用モックデータを使用します。", error);
            // APIエラー時（ID無効やCORS制限など）のフォールバック用モックデータ
            const fallbackProducts = [
                { name: "【送料無料】最高級黒毛和牛 焼肉セット 500g", price: 5980, description: "とろけるような食感の最高級黒毛和牛。", image: "https://placehold.co/128x128/ef4444/white?text=Wagyu", url: "#", tags: ["【送料無料】"] },
                { name: "【ノイズキャンセリング機能付き】ワイヤレスイヤホン", price: 12800, description: "最新のノイズキャンセリング機能を搭載した高音質イヤホン。", image: "https://placehold.co/128x128/3b82f6/white?text=Earphone", url: "#", tags: ["【ノイズキャンセリング機能付き】"] },
                { name: "【ギフト最適】京都抹茶スイーツ詰め合わせ", price: 3240, description: "老舗茶屋が作る濃厚抹茶スイーツの贅沢セット。", image: "https://placehold.co/128x128/10b981/white?text=Matcha", url: "#", tags: ["【ギフト最適】"] },
                { name: "【自動ゴミ収集】ロボット掃除機 スマホ連動", price: 45000, description: "スマホアプリ連携で簡単お掃除。自動ゴミ収集機能付き。", image: "https://placehold.co/128x128/6b7280/white?text=Robot", url: "#", tags: ["【自動ゴミ収集】"] },
                { name: "【まとめ買い】天然水 ミネラルウォーター 500ml×24本", price: 1980, description: "大自然で育まれた美味しい天然水。", image: "https://placehold.co/128x128/0ea5e9/white?text=Water", url: "#", tags: ["【まとめ買い】"] }
            ];

            // 要求されたラウンド数分だけモックを返す（足りない場合は繰り返し）
            let items = [];
            for (let i = 0; i < rounds; i++) {
                items.push(fallbackProducts[i % fallbackProducts.length]);
            }
            return items.sort(() => 0.5 - Math.random());
        }
    };

    const isHost = room?.hostId === user?.uid;

    if (!user) return <div className="flex justify-center items-center h-screen bg-yellow-50 font-pop"><p>読み込み中...</p></div>;

    return (
        <div className="min-h-screen bg-[#FFFBEB] font-pop text-gray-800 p-4 md:p-8 flex flex-col items-center">
            {/* Background Pattern */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#EF4444 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>

            <div className="w-full max-w-4xl relative z-10">
                {!currentRoomId ? (
                    <TitleScreen
                        playerName={playerName} setPlayerName={setPlayerName}
                        roomIdInput={roomIdInput} setRoomIdInput={setRoomIdInput}
                        handleCreateRoom={handleCreateRoom} handleJoinRoom={handleJoinRoom}
                        error={error} isLoading={isLoading}
                    />
                ) : room?.status === 'lobby' ? (
                    <LobbyScreen room={room} isHost={isHost} roomRef={doc(db, 'artifacts', appId, 'public', 'data', 'rooms', currentRoomId)} fetchProducts={fetchProducts} user={user} />
                ) : room?.status === 'playing' ? (
                    <GameScreen room={room} roomRef={doc(db, 'artifacts', appId, 'public', 'data', 'rooms', currentRoomId)} user={user} isHost={isHost} />
                ) : room?.status === 'roundEnd' ? (
                    <RoundEndScreen room={room} user={user} isHost={isHost} roomRef={doc(db, 'artifacts', appId, 'public', 'data', 'rooms', currentRoomId)} />
                ) : room?.status === 'result' ? (
                    <ResultScreen room={room} />
                ) : null}
            </div>
        </div>
    );
}

// --- Screens ---

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
                <p className="text-lg font-bold text-gray-600">商品の値段をピッタリ当てろ！</p>
            </div>

            <div className="bg-white border-4 border-red-500 rounded-2xl p-8 box-shadow-pop w-full max-w-md space-y-6">
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" /> {error}
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
                        <Home className="w-6 h-6" /> 部屋を作る
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
                        className="w-1/2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl text-lg btn-pop box-shadow-pop-sm"
                    >
                        部屋に入る
                    </button>
                </div>
            </div>
        </div>
    );
}

function LobbyScreen({ room, isHost, roomRef, fetchProducts, user }) {
    const [isStarting, setIsStarting] = useState(false);
    const [lobbyError, setLobbyError] = useState('');

    const updateSetting = async (key, value) => {
        if (!isHost) return;
        await updateDoc(roomRef, { [`settings.${key}`]: value });
    };

    const startGame = async () => {
        if (!isHost) return;
        setIsStarting(true);
        setLobbyError('');
        try {
            const products = await fetchProducts(room.settings.genreId, room.settings.rounds);

            if (products.length === 0) {
                throw new Error("商品が見つかりませんでした");
            }

            await updateDoc(roomRef, {
                products,
                status: 'playing',
                currentRound: 0,
                roundEndTime: Date.now() + (room.settings.timeLimit * 1000) + 2000 // +2s buffer
            });
        } catch (e) {
            console.error(e);
            setLobbyError("商品の取得に失敗しました。時間をおいて再試行してください。");
            setIsStarting(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 mt-6">
            <div className="flex-1 bg-white border-4 border-red-500 rounded-2xl p-6 box-shadow-pop">
                <div className="flex justify-between items-center mb-6 pb-4 border-b-4 border-dashed border-gray-200">
                    <h2 className="text-3xl font-black text-red-500 flex items-center gap-2">
                        <Users className="w-8 h-8" /> 参加者
                    </h2>
                    <div className="bg-red-100 border-2 border-red-500 text-red-700 px-4 py-2 rounded-xl font-bold text-lg tracking-widest">
                        ID: {room.roomId}
                    </div>
                </div>

                <div className="space-y-3">
                    {Object.entries(room.players).map(([id, p]) => (
                        <div key={id} className="flex items-center gap-3 bg-gray-50 border-2 border-gray-200 p-3 rounded-xl">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${id === user.uid ? 'bg-red-500' : 'bg-gray-400'}`}>
                                {p.name.charAt(0)}
                            </div>
                            <span className="text-xl font-bold flex-1">{p.name}</span>
                            {id === room.hostId && <Crown className="text-yellow-500 w-6 h-6" />}
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
                            value={room.settings.genreId} onChange={(e) => updateSetting('genreId', e.target.value)}
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
                                    className={`flex-1 py-2 rounded-xl border-4 font-bold text-lg transition-colors ${room.settings.rounds === r ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 text-gray-500'}`}
                                >{r}回</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-gray-700 font-bold mb-2">制限時間</label>
                        <div className="flex gap-2">
                            {[15, 30, 60].map(t => (
                                <button key={t} disabled={!isHost} onClick={() => updateSetting('timeLimit', t)}
                                    className={`flex-1 py-2 rounded-xl border-4 font-bold text-lg transition-colors ${room.settings.timeLimit === t ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 text-gray-500'}`}
                                >{t}秒</button>
                            ))}
                        </div>
                    </div>
                </div>

                {isHost ? (
                    <div className="mt-8">
                        {lobbyError && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 mb-4 text-sm font-bold">
                                <AlertCircle className="w-5 h-5 shrink-0" /> {lobbyError}
                            </div>
                        )}
                        <button
                            onClick={startGame} disabled={isStarting || Object.keys(room.players).length < 1}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl text-xl transition-all shadow-[0px_4px_0px_#1d4ed8] active:shadow-none active:translate-y-[4px] flex justify-center items-center gap-2 disabled:opacity-50"
                        >
                            {isStarting ? '準備中...' : <><Play className="w-6 h-6 fill-current" /> ゲーム開始</>}
                        </button>
                    </div>
                ) : (
                    <div className="w-full mt-8 bg-gray-200 text-gray-500 font-bold py-4 rounded-xl text-xl text-center border-4 border-gray-300">
                        ホストの開始を待っています...
                    </div>
                )}
            </div>
        </div>
    );
}

function GameScreen({ room, roomRef, user, isHost }) {
    const [guess, setGuess] = useState('');
    const [timeLeft, setTimeLeft] = useState(room.settings.timeLimit);
    const isTransitioning = useRef(false);
    const me = room.players[user.uid];

    const currentProduct = room.products[room.currentRound];

    // Timer & Auto-Transition logic
    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((room.roundEndTime - Date.now()) / 1000));
            setTimeLeft(remaining);

            // Host handles transition when time is up or everyone guessed
            if (isHost && !isTransitioning.current) {
                const allGuessed = Object.values(room.players).every(p => p.hasGuessed);
                if (remaining <= 0 || allGuessed) {
                    isTransitioning.current = true;
                    handleRoundEnd();
                }
            }
        }, 500);
        return () => clearInterval(interval);
    }, [room.roundEndTime, room.players, isHost]);

    // Reset transition lock when round changes
    useEffect(() => {
        isTransitioning.current = false;
    }, [room.currentRound]);

    const handleRoundEnd = async () => {
        // Calculate scores
        const actualPrice = currentProduct.price;
        const updates = { status: 'roundEnd', nextRoundStartTime: Date.now() + 8000 };

        Object.entries(room.players).forEach(([id, p]) => {
            let points = 0;
            if (p.hasGuessed && p.currentGuess) {
                // Scoring logic: Max 1000 pts. Diff > 100% means 0 pts.
                const diff = Math.abs(p.currentGuess - actualPrice);
                const percentOff = diff / actualPrice;
                points = Math.max(0, Math.floor((1 - percentOff) * 1000));
            }
            updates[`players.${id}.score`] = p.score + points;
            updates[`players.${id}.lastPoints`] = points; // Temporary hold to show in UI
        });

        await updateDoc(roomRef, updates);
    };

    const submitGuess = async (e) => {
        e.preventDefault();
        if (!guess || isNaN(guess) || me.hasGuessed) return;

        await updateDoc(roomRef, {
            [`players.${user.uid}.currentGuess`]: parseInt(guess, 10),
            [`players.${user.uid}.hasGuessed`]: true
        });
    };

    if (!currentProduct) return <div>Loading...</div>;

    return (
        <div className="mt-4 flex flex-col items-center">
            {/* Header Status */}
            <div className="w-full flex justify-between items-center mb-4 px-2">
                <div className="bg-red-500 text-white font-black text-xl px-4 py-2 rounded-xl border-4 border-red-700 box-shadow-pop-sm">
                    Round {room.currentRound + 1} <span className="text-red-200 text-sm">/ {room.settings.rounds}</span>
                </div>
                <div className={`font-black text-3xl flex items-center gap-2 ${timeLeft <= 5 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
                    <Clock className="w-8 h-8" /> {timeLeft}秒
                </div>
            </div>

            {/* Product Display */}
            <div className="w-full bg-white border-4 border-red-500 rounded-3xl p-6 box-shadow-pop flex flex-col md:flex-row gap-6 items-center md:items-start mb-6">
                <div className="w-full md:w-1/2 flex flex-col items-center gap-4">
                    <div className="w-64 h-64 bg-gray-100 rounded-2xl border-4 border-gray-200 flex items-center justify-center overflow-hidden relative group">
                        <img src={currentProduct.image} alt="Product" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {currentProduct.tags.slice(0, 4).map((tag, i) => (
                            <span key={i} className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md">{tag}</span>
                        ))}
                    </div>
                </div>

                <div className="w-full md:w-1/2 flex flex-col gap-4">
                    <h3 className="text-xl md:text-2xl font-bold leading-snug">{currentProduct.name}</h3>
                    <p className="text-sm text-gray-500 line-clamp-4 bg-gray-50 p-3 rounded-xl border-2 border-gray-100">{currentProduct.description}</p>
                </div>
            </div>

            {/* Input Area */}
            <div className="w-full max-w-2xl bg-white border-4 border-gray-300 rounded-2xl p-6 box-shadow-pop-sm">
                {me.hasGuessed ? (
                    <div className="text-center py-6">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-gray-700">予想完了！</h3>
                        <p className="text-gray-500 mt-2">
                            {Object.keys(room.players).length > 1 ? "他のプレイヤーを待っています..." : "まもなく正解発表です..."}
                        </p>
                        <div className="mt-4 flex gap-2 justify-center">
                            {Object.values(room.players).map((p, i) => (
                                <div key={i} className={`w-3 h-3 rounded-full ${p.hasGuessed ? 'bg-green-500' : 'bg-gray-300 animate-bounce'}`} style={{ animationDelay: `${i * 0.1}s` }}></div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submitGuess} className="flex flex-col gap-4">
                        <label className="text-center text-xl font-bold text-gray-700">ズバリ、いくら？</label>
                        <div className="flex items-center gap-3">
                            <span className="text-4xl font-black text-gray-400">¥</span>
                            <input
                                type="number" autoFocus placeholder="1000"
                                className="flex-1 border-4 border-gray-300 rounded-xl px-4 py-4 text-3xl font-bold focus:border-red-500 focus:outline-none text-right"
                                value={guess} onChange={(e) => setGuess(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit" disabled={!guess}
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl text-2xl btn-pop box-shadow-pop-sm disabled:opacity-50 mt-2"
                        >
                            決定！
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

function RoundEndScreen({ room, user, isHost, roomRef }) {
    const currentProduct = room.products[room.currentRound];
    const sortedPlayers = Object.entries(room.players).sort((a, b) => b[1].lastPoints - a[1].lastPoints);

    useEffect(() => {
        if (!isHost) return;
        const timeout = setTimeout(() => {
            const isLastRound = room.currentRound >= room.settings.rounds - 1;
            const updates = { status: isLastRound ? 'result' : 'playing' };

            if (!isLastRound) {
                updates.currentRound = room.currentRound + 1;
                updates.roundEndTime = Date.now() + (room.settings.timeLimit * 1000) + 2000;
                // Reset guesses
                Object.keys(room.players).forEach(id => {
                    updates[`players.${id}.currentGuess`] = null;
                    updates[`players.${id}.hasGuessed`] = false;
                });
            }
            updateDoc(roomRef, updates);
        }, Math.max(0, room.nextRoundStartTime - Date.now()));

        return () => clearTimeout(timeout);
    }, [isHost, room.nextRoundStartTime]);

    return (
        <div className="mt-8 flex flex-col items-center animation-fadeIn">
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
                        <div key={id} className={`flex items-center gap-4 bg-white border-4 rounded-2xl p-4 ${id === user.uid ? 'border-red-500 box-shadow-pop-sm' : 'border-gray-200'}`}>
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

function ResultScreen({ room }) {
    const sortedPlayers = Object.entries(room.players).sort((a, b) => b[1].score - a[1].score);
    const winner = sortedPlayers[0];

    return (
        <div className="mt-8 flex flex-col items-center">
            <h2 className="text-5xl font-black text-yellow-500 mb-8 flex items-center gap-3 bg-white px-8 py-4 rounded-3xl border-4 border-yellow-400 shadow-[4px_6px_0px_#eab308]">
                <Trophy className="w-12 h-12" /> 最終結果
            </h2>

            {/* Podium */}
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
                    {room.products.map((prod, i) => (
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