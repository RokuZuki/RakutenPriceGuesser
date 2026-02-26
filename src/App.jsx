import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users, User, Settings, Clock, Play, Link as LinkIcon, Crown, CheckCircle2, AlertCircle, Home, ShoppingCart, Loader2, Copy, Check, Star, X, LogOut, RefreshCw, AlertTriangle, Info, MessageCircle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

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

    // --- AdSense Integration ---
    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5871148617904389";
        script.async = true;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
    }, []);

    // App States
    const [playerName, setPlayerName] = useState('');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [currentRoomId, setCurrentRoomId] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const [productFetchError, setProductFetchError] = useState(false);

    // Emote State
    const [activeEmotes, setActiveEmotes] = useState([]);

    // --- Result Screen Keep States ---
    const [keepResultScreen, setKeepResultScreen] = useState(false);
    const keepResultScreenRef = useRef(false);
    const [hostDisconnected, setHostDisconnected] = useState(false);
    const [resultData, setResultData] = useState(null);

    useEffect(() => {
        keepResultScreenRef.current = keepResultScreen;
    }, [keepResultScreen]);

    // P2P States & Refs
    const peerRef = useRef(null);
    const connRef = useRef(null);
    const hostConnectionsRef = useRef([]);
    const myPeerIdRef = useRef(null);

    // Game State
    const initialGameState = {
        status: 'lobby',
        settings: { genreId: '0', timeLimit: 30, rounds: 3, keyword: '', doubleFinalRound: true, showLiveGuess: false, gameMode: 'normal' },
        currentRound: 0,
        products: [],
        players: {},
        roundEndTime: 0,
        nextRoundStartTime: 0
    };
    const [gameState, setGameState] = useState(initialGameState);
    const gameStateRef = useRef(initialGameState);

    // --- State Sync for Keep Result ---
    useEffect(() => {
        if (gameState.status === 'result') {
            setKeepResultScreen(true);
            setResultData(prev => prev || gameState);
        } else if (gameState.status === 'playing') {
            setKeepResultScreen(false);
            setResultData(null);
        }
    }, [gameState.status, gameState]);

    let displayStatus = gameState.status;
    if (gameState.status === 'result' || gameState.status === 'lobby') {
        if (hostDisconnected) {
            displayStatus = 'result';
        } else {
            displayStatus = keepResultScreen ? 'result' : 'lobby';
        }
    }

    // 画面遷移時に一番上にスクロールする処理 ＋ URLハッシュによる擬似ページ分割
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        let targetHash = '#title';
        if (currentRoomId) {
            if (displayStatus === 'lobby') targetHash = '#lobby';
            else if (displayStatus === 'playing' || displayStatus === 'roundEnd') targetHash = '#battle';
            else if (displayStatus === 'result') targetHash = '#result';
        }

        const currentHash = window.location.hash || '#title';

        if (currentHash !== targetHash) {
            try {
                if (targetHash === '#title') {
                    window.history.replaceState(null, '', window.location.pathname + window.location.search + targetHash);
                } else {
                    window.history.pushState(null, '', window.location.pathname + window.location.search + targetHash);
                }
            } catch (err) {
                window.location.hash = targetHash;
            }
        }
    }, [displayStatus, currentRoomId]);

    // ブラウザの「戻る」「進む」ボタンに対する安全対策
    useEffect(() => {
        const handlePopState = () => {
            if (currentRoomId) window.location.reload();
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [currentRoomId]);

    // UI Styles & Animations Injection (Rich Redesign)
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap');
      
      body {
        font-family: 'Noto Sans JP', sans-serif;
        color: #1e293b;
        overflow-x: hidden;
      }
      
      /* Animated Background Pattern Base */
      .bg-animated-pattern {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: -1;
        transition: background 1s ease;
      }
      
      /* Normal Mode (Elegant Red Gradient) */
      .bg-pattern-normal {
        background: linear-gradient(135deg, #991b1b, #b91c1c, #7f1d1d);
        background-size: 200% 200%;
        animation: gradientShift 10s ease infinite;
      }
      .bg-pattern-normal::before {
        content: ""; position: absolute; inset: 0;
        background-image: radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px);
        background-size: 30px 30px;
        opacity: 0.8;
      }
      
      /* Dobon Mode (Warning Stripes with Blur) */
      .bg-pattern-dobon {
        background: repeating-linear-gradient(-45deg, #7f1d1d, #7f1d1d 20px, #450a0a 20px, #450a0a 40px);
        animation: scrollBgDiag 2s linear infinite;
        opacity: 0.95;
      }

      /* HighLow Mode (Dynamic Blue/Purple) */
      .bg-pattern-highlow {
        background: linear-gradient(135deg, #1e3a8a, #4c1d95, #312e81);
        background-size: 200% 200%;
        animation: gradientShift 8s ease infinite;
      }
      .bg-pattern-highlow::after {
        content: ""; position: absolute; inset: 0;
        background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 40px 40px;
      }

      /* Celeb Mode (Luxury Black/Gold) */
      .bg-pattern-celeb {
        background: radial-gradient(circle at center, #2e1005, #000000);
      }
      .bg-pattern-celeb::before {
        content: ""; position: absolute; inset: 0;
        background-image: radial-gradient(circle at 15px 15px, rgba(251, 191, 36, 0.3) 2px, transparent 3px), radial-gradient(circle at 45px 45px, rgba(251, 191, 36, 0.15) 1px, transparent 2px);
        background-size: 60px 60px;
        animation: scrollBgSlow 5s linear infinite;
      }

      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes scrollBgDiag { 0% { background-position: 0 0; } 100% { background-position: 56.56px 56.56px; } }
      @keyframes scrollBgSlow { 0% { background-position: 0 0; } 100% { background-position: 60px 60px; } }
      
      /* Panels & Cards - Glassmorphism */
      .panel {
        background: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 1.5rem;
        box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8);
      }
      
      /* Buttons */
      .btn-solid {
        border: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 6px 15px rgba(0,0,0,0.15);
        position: relative;
        overflow: hidden;
      }
      .btn-solid::after {
        content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
        transform: skewX(-20deg);
        transition: 0.5s;
      }
      .btn-solid:hover::after {
        left: 150%;
      }
      .btn-solid:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0,0,0,0.2);
      }
      .btn-solid:active:not(:disabled) {
        transform: translateY(1px) scale(0.98);
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .btn-solid:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
      
      /* Animations */
      @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      .animate-float { animation: float 3s ease-in-out infinite; }
      
      @keyframes pulse-pop { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      .animate-pulse-pop { animation: pulse-pop 2s infinite; }

      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fadeIn { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

      @keyframes float-up {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          20% { transform: translateY(-30px) scale(1.2); opacity: 1; }
          80% { transform: translateY(-100px) scale(1); opacity: 1; }
          100% { transform: translateY(-130px) scale(0.8); opacity: 0; }
      }
      .animate-float-up { animation: float-up 2.5s ease-out forwards; }
      
      /* Custom Scrollbar */
      .custom-scrollbar::-webkit-scrollbar { width: 10px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.02); border-radius: 8px;}
      .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 8px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
    `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    // --- Emote Functions ---
    const addEmoteToScreen = (senderId, emoji) => {
        const newEmote = {
            id: Date.now() + Math.random(),
            senderId,
            emoji,
            left: 10 + Math.random() * 70,
        };
        setActiveEmotes(prev => [...prev, newEmote]);
        setTimeout(() => {
            setActiveEmotes(prev => prev.filter(e => e.id !== newEmote.id));
        }, 2500);
    };

    const handleSendEmote = (emoji) => {
        addEmoteToScreen(myPeerIdRef.current, emoji);
        if (isHost) {
            hostConnectionsRef.current.forEach(conn => {
                if (conn.open) conn.send({ type: 'EMOTE', senderId: myPeerIdRef.current, emoji });
            });
        } else if (connRef.current && connRef.current.open) {
            connRef.current.send({ type: 'EMOTE', emoji });
        }
    };

    // --- Host Functions ---
    const updateGameState = (updater) => {
        setGameState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
            gameStateRef.current = next;
            hostConnectionsRef.current.forEach(conn => {
                if (conn.open) conn.send({ type: 'SYNC', state: next });
            });
            return next;
        });
    };

    const handleCreateRoom = () => {
        if (!playerName.trim()) return setError('名前を入力してください');
        setIsLoading(true);
        setProductFetchError(false);

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
                players: { [id]: { name: playerName, score: 0, currentGuess: null, hasGuessed: false, liveGuess: null, isDobon: false, isHost: true } }
            });
        });

        peer.on('connection', (conn) => {
            hostConnectionsRef.current.push(conn);
            conn.on('data', (data) => {
                if (data.type === 'JOIN') {
                    updateGameState(prev => ({
                        ...prev,
                        players: { ...prev.players, [conn.peer]: { name: data.name, score: 0, currentGuess: null, hasGuessed: false, liveGuess: null, isDobon: false, isHost: false } }
                    }));
                } else if (data.type === 'GUESS') {
                    updateGameState(prev => ({
                        ...prev,
                        players: { ...prev.players, [conn.peer]: { ...prev.players[conn.peer], currentGuess: data.guess, hasGuessed: true, liveGuess: null } }
                    }));
                } else if (data.type === 'LIVE_GUESS') {
                    updateGameState(prev => ({
                        ...prev,
                        players: { ...prev.players, [conn.peer]: { ...prev.players[conn.peer], liveGuess: data.guess } }
                    }));
                } else if (data.type === 'EMOTE') {
                    addEmoteToScreen(conn.peer, data.emoji);
                    hostConnectionsRef.current.forEach(c => {
                        if (c.peer !== conn.peer && c.open) {
                            c.send({ type: 'EMOTE', senderId: conn.peer, emoji: data.emoji });
                        }
                    });
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

            let isIntentionalClose = false;

            conn.on('data', (data) => {
                if (data.type === 'SYNC') {
                    setGameState(data.state);
                    gameStateRef.current = data.state;
                } else if (data.type === 'ROOM_CLOSED') {
                    isIntentionalClose = true;
                    if (keepResultScreenRef.current) {
                        setHostDisconnected(true);
                    } else {
                        setError('ホストがルームを解散しました。');
                        setCurrentRoomId(null);
                        setGameState(initialGameState);
                    }
                } else if (data.type === 'KICKED') {
                    isIntentionalClose = true;
                    setError('ルームから退出させられました。');
                    setCurrentRoomId(null);
                    setGameState(initialGameState);
                    setKeepResultScreen(false);
                } else if (data.type === 'EMOTE') {
                    addEmoteToScreen(data.senderId, data.emoji);
                }
            });

            conn.on('close', () => {
                if (!isIntentionalClose) {
                    if (keepResultScreenRef.current) {
                        setHostDisconnected(true);
                    } else {
                        setError('ホストとの通信が切断されました。');
                        setCurrentRoomId(null);
                        setGameState(initialGameState);
                    }
                }
            });
        });

        peer.on('error', (err) => {
            setError('入室に失敗しました: ' + err.type);
            setIsLoading(false);
        });
    };

    const handleKickPlayer = (targetPeerId) => {
        if (!isHost || targetPeerId === myPeerIdRef.current) return;
        const conn = hostConnectionsRef.current.find(c => c.peer === targetPeerId);
        if (conn && conn.open) {
            conn.send({ type: 'KICKED' });
            setTimeout(() => conn.close(), 500);
        }
        hostConnectionsRef.current = hostConnectionsRef.current.filter(c => c.peer !== targetPeerId);
        updateGameState(prev => {
            const newPlayers = { ...prev.players };
            delete newPlayers[targetPeerId];
            return { ...prev, players: newPlayers };
        });
    };

    const handleLeaveRoom = () => {
        if (isHost) {
            hostConnectionsRef.current.forEach(conn => {
                if (conn.open) conn.send({ type: 'ROOM_CLOSED' });
            });
        }
        setTimeout(() => {
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }
            hostConnectionsRef.current = [];
            connRef.current = null;
            setCurrentRoomId(null);
            setGameState(initialGameState);
            setIsHost(false);
            setError('');
            setProductFetchError(false);
            setActiveEmotes([]);
            setHostDisconnected(false);
            setKeepResultScreen(false);
            setResultData(null);
        }, 100);
    };

    const handleReturnToLobby = () => {
        setKeepResultScreen(false);
        setResultData(null);
        if (isHost) {
            const resetPlayers = {};
            Object.keys(gameState.players).forEach(id => {
                resetPlayers[id] = { ...gameState.players[id], score: 0, currentGuess: null, hasGuessed: false, liveGuess: null, isDobon: false, lastPoints: 0 };
            });
            updateGameState({
                status: 'lobby',
                currentRound: 0,
                players: resetPlayers,
                products: []
            });
        }
    };

    const getMockProducts = (rounds, gameMode) => {
        const fallbackProducts = [
            { name: "【送料無料】最高級黒毛和牛 焼肉セット 500g", price: 5980, description: "とろけるような食感の最高級黒毛和牛。お歳暮やギフトにぴったりです。厳選された部位を丁寧にカットしてお届けします。", image: "https://placehold.co/400x400/ef4444/white?text=Wagyu+1", images: ["https://placehold.co/400x400/ef4444/white?text=Wagyu+1"], url: "https://www.rakuten.co.jp/", tags: ["肉のたじまや", "送料無料"], reviewCount: 1250, reviewAverage: 4.8 },
            { name: "【ノイズキャンセリング機能付き】ワイヤレスイヤホン", price: 12800, description: "最新のノイズキャンセリング機能を搭載した高音質イヤホン。長時間のバッテリー駆動と、クリアな通話品質。", image: "https://placehold.co/400x400/3b82f6/white?text=Earphone+1", images: ["https://placehold.co/400x400/3b82f6/white?text=Earphone+1"], url: "https://www.rakuten.co.jp/", tags: ["家電のさくら", "ノイズキャンセリング機能付き"], reviewCount: 840, reviewAverage: 4.5 },
            { name: "【ギフト最適】京都抹茶スイーツ詰め合わせ", price: 3240, description: "老舗茶屋が作る濃厚抹茶スイーツの贅沢セット。抹茶ロールケーキ、抹茶プリン、抹茶クッキーなど。", image: "https://placehold.co/400x400/10b981/white?text=Matcha+1", images: ["https://placehold.co/400x400/10b981/white?text=Matcha+1"], url: "https://www.rakuten.co.jp/", tags: ["京都老舗茶屋", "ギフト最適"], reviewCount: 2310, reviewAverage: 4.9 }
        ];

        let items = [];
        for (let i = 0; i < rounds; i++) {
            let item = { ...fallbackProducts[i % fallbackProducts.length] };
            if (gameMode === 'celeb') item.price = item.price * 15;
            items.push(item);
        }

        items = items.sort(() => 0.5 - Math.random());

        if (gameMode === 'highlow') {
            items = items.map(item => {
                const offsetPercent = 0.1 + Math.random() * 0.4;
                const sign = Math.random() > 0.5 ? 1 : -1;
                let basePrice = Math.floor(item.price * (1 + offsetPercent * sign));
                if (basePrice <= 0) basePrice = Math.floor(item.price / 2);
                basePrice = Math.round(basePrice / 100) * 100;
                return { ...item, basePrice };
            });
        }
        return items;
    };

    const fetchProducts = async (genreId, rounds, keyword, gameMode) => {
        let rawItems = [];
        let isCeleb = gameMode === 'celeb';
        let apiKeyword = keyword;

        if (isCeleb && (!keyword || keyword.trim() === '') && genreId === '0') {
            apiKeyword = "高級";
        }

        let minPriceParam = isCeleb ? "&minPrice=50000" : "";

        if ((apiKeyword && apiKeyword.trim() !== '') || isCeleb) {
            const urlPage1 = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601?format=json&keyword=${encodeURIComponent(apiKeyword || "高級")}${genreId !== '0' ? `&genreId=${genreId}` : ''}&affiliateId=${RAKUTEN_AFFILIATE_ID}&applicationId=${RAKUTEN_APP_ID}&accessKey=${RAKUTEN_ACCESS_KEY}${minPriceParam}&page=1`;
            const res1 = await fetch(urlPage1);
            if (!res1.ok) throw new Error(`API Error: ${res1.status}`);
            const data1 = await res1.json();

            if (!data1.Items || data1.Items.length === 0) throw new Error("商品が見つかりませんでした");

            const maxPage = Math.min(10, data1.pageCount || 1);
            let targetData = data1;

            if (maxPage > 1) {
                const randomSearchPage = Math.floor(Math.random() * maxPage) + 1;
                if (randomSearchPage !== 1) {
                    const urlRandom = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601?format=json&keyword=${encodeURIComponent(apiKeyword || "高級")}${genreId !== '0' ? `&genreId=${genreId}` : ''}&affiliateId=${RAKUTEN_AFFILIATE_ID}&applicationId=${RAKUTEN_APP_ID}&accessKey=${RAKUTEN_ACCESS_KEY}${minPriceParam}&page=${randomSearchPage}`;
                    const resRandom = await fetch(urlRandom);
                    if (resRandom.ok) {
                        const dataRandom = await resRandom.json();
                        if (dataRandom.Items && dataRandom.Items.length > 0) targetData = dataRandom;
                    }
                }
            }
            rawItems = targetData.Items;
        } else {
            const randomRankPage = Math.floor(Math.random() * 30) + 1;
            const urlRank = `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601?format=json&affiliateId=${RAKUTEN_AFFILIATE_ID}${genreId !== '0' ? `&genreId=${genreId}` : ''}&applicationId=${RAKUTEN_APP_ID}&accessKey=${RAKUTEN_ACCESS_KEY}&page=${randomRankPage}`;

            let res = await fetch(urlRank);
            let data = res.ok ? await res.json() : null;

            if (!data || !data.Items || data.Items.length === 0) {
                const urlFallback = `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601?format=json&affiliateId=${RAKUTEN_AFFILIATE_ID}${genreId !== '0' ? `&genreId=${genreId}` : ''}&applicationId=${RAKUTEN_APP_ID}&accessKey=${RAKUTEN_ACCESS_KEY}&page=1`;
                res = await fetch(urlFallback);
                if (!res.ok) throw new Error(`API Error: ${res.status}`);
                data = await res.json();
            }

            if (!data.Items || data.Items.length === 0) throw new Error("商品が見つかりませんでした");
            rawItems = data.Items;
        }

        let items = rawItems.map(i => {
            const extractedTags = i.Item.itemName.match(/【.*?】/g) || [];
            const cleanTags = extractedTags.map(tag => tag.replace(/[【】]/g, ''));
            if (i.Item.shopName) cleanTags.unshift(i.Item.shopName);

            const images = i.Item.mediumImageUrls?.slice(0, 3).map(img => img.imageUrl?.replace('?_ex=128x128', '')).filter(Boolean) || [];

            return {
                name: i.Item.itemName,
                price: i.Item.itemPrice,
                description: i.Item.itemCaption || '商品説明はありません。',
                image: images[0] || 'https://placehold.co/400x400/gray/white?text=No+Image',
                images: images,
                url: i.Item.affiliateUrl || i.Item.itemUrl,
                tags: cleanTags,
                reviewCount: i.Item.reviewCount || 0,
                reviewAverage: i.Item.reviewAverage || 0
            };
        }).filter(i => i.image && i.price > 0);

        if (items.length < rounds) throw new Error("商品数が足りません");

        let finalItems = items.sort(() => 0.5 - Math.random()).slice(0, rounds);

        if (gameMode === 'highlow') {
            finalItems = finalItems.map(item => {
                const offsetPercent = 0.1 + Math.random() * 0.4;
                const sign = Math.random() > 0.5 ? 1 : -1;
                let basePrice = Math.floor(item.price * (1 + offsetPercent * sign));
                if (basePrice <= 0) basePrice = Math.floor(item.price / 2);
                basePrice = Math.round(basePrice / 100) * 100;
                return { ...item, basePrice };
            });
        }

        return finalItems;
    };

    const handleStartGame = async (useMock = false) => {
        setIsLoading(true);
        setProductFetchError(false);
        try {
            let products;
            if (useMock) {
                products = getMockProducts(gameState.settings.rounds, gameState.settings.gameMode);
            } else {
                products = await fetchProducts(gameState.settings.genreId, gameState.settings.rounds, gameState.settings.keyword, gameState.settings.gameMode);
            }
            updateGameState({ status: 'playing', products, currentRound: 0, roundEndTime: gameState.settings.timeLimit === 0 ? 0 : Date.now() + (gameState.settings.timeLimit * 1000) + 2000 });
        } catch (error) {
            console.error("API呼び出し失敗:", error);
            setProductFetchError(true);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (!isHost) return;
        const interval = setInterval(() => {
            const state = gameStateRef.current;
            if (state.status === 'playing') {
                const isUnlimited = state.settings.timeLimit === 0;
                const remaining = isUnlimited ? 1 : state.roundEndTime - Date.now();
                const playersArr = Object.values(state.players);
                const allGuessed = playersArr.length > 0 && playersArr.every(p => p.hasGuessed);
                const isTimeUp = !isUnlimited && remaining <= 0;

                if (isTimeUp || allGuessed) {
                    const currentProduct = state.products[state.currentRound];
                    const newPlayers = { ...state.players };

                    const isFinalRound = state.currentRound === state.settings.rounds - 1;
                    const multiplier = (state.settings.doubleFinalRound && isFinalRound) ? 2 : 1;

                    Object.keys(newPlayers).forEach(id => {
                        const p = newPlayers[id];
                        let points = 0;
                        let isDobon = false;

                        if (p.hasGuessed && p.currentGuess !== null) {
                            if (state.settings.gameMode === 'highlow') {
                                const isHigh = currentProduct.price > currentProduct.basePrice;
                                const correctGuess = isHigh ? 'high' : 'low';
                                if (p.currentGuess === correctGuess) {
                                    points = 1000 * multiplier;
                                }
                            } else if (state.settings.gameMode === 'dobon') {
                                const guessVal = Number(p.currentGuess);
                                if (guessVal > currentProduct.price) {
                                    points = 0;
                                    isDobon = true;
                                } else {
                                    const diff = currentProduct.price - guessVal;
                                    const percentOff = diff / currentProduct.price;
                                    points = Math.max(0, Math.floor((1 - percentOff) * 1000)) * multiplier;
                                }
                            } else {
                                const guessVal = Number(p.currentGuess);
                                const diff = Math.abs(guessVal - currentProduct.price);
                                const percentOff = diff / currentProduct.price;
                                points = Math.max(0, Math.floor((1 - percentOff) * 1000)) * multiplier;
                            }
                        }
                        newPlayers[id] = { ...p, score: p.score + points, lastPoints: points, liveGuess: null, isDobon };
                    });
                    updateGameState({ status: 'roundEnd', players: newPlayers, nextRoundStartTime: Date.now() + 8000 });
                }
            } else if (state.status === 'roundEnd') {
                const remaining = state.nextRoundStartTime - Date.now();
                if (remaining <= 0) {
                    if (state.currentRound >= state.settings.rounds - 1) {
                        updateGameState({ status: 'result' });
                    } else {
                        const resetPlayers = {};
                        Object.keys(state.players).forEach(id => {
                            resetPlayers[id] = { ...state.players[id], currentGuess: null, hasGuessed: false, liveGuess: null, isDobon: false };
                        });
                        updateGameState({
                            status: 'playing', currentRound: state.currentRound + 1,
                            roundEndTime: state.settings.timeLimit === 0 ? 0 : Date.now() + (state.settings.timeLimit * 1000) + 2000,
                            players: resetPlayers
                        });
                    }
                }
            }
        }, 500);
        return () => clearInterval(interval);
    }, [isHost]);

    const submitGuess = (guessValue) => {
        let val = guessValue;
        if (gameState.settings.gameMode !== 'highlow') {
            val = parseInt(guessValue, 10);
            if (isNaN(val) || val < 0) return;
        }
        if (isHost) {
            updateGameState(prev => ({
                ...prev, players: { ...prev.players, [myPeerIdRef.current]: { ...prev.players[myPeerIdRef.current], currentGuess: val, hasGuessed: true, liveGuess: null } }
            }));
        } else if (connRef.current && connRef.current.open) {
            connRef.current.send({ type: 'GUESS', guess: val });
        }
    };

    const sendLiveGuess = (guessValue) => {
        if (isHost) {
            updateGameState(prev => ({
                ...prev,
                players: { ...prev.players, [myPeerIdRef.current]: { ...prev.players[myPeerIdRef.current], liveGuess: guessValue } }
            }));
        } else if (connRef.current && connRef.current.open) {
            connRef.current.send({ type: 'LIVE_GUESS', guess: guessValue });
        }
    };

    if (!peerReady) {
        return <div className="flex flex-col justify-center items-center h-screen bg-slate-900 font-pop text-white gap-4"><Loader2 className="w-16 h-16 animate-spin text-red-500" /><p className="font-bold text-2xl tracking-widest">通信準備中...</p></div>;
    }

    return (
        <>
            <div className={`bg-animated-pattern bg-pattern-${gameState.settings.gameMode}`}></div>
            <div className="min-h-screen p-4 md:p-8 flex flex-col items-center relative z-10">
                <div className="w-full max-w-5xl">
                    {!currentRoomId ? (
                        <TitleScreen
                            playerName={playerName} setPlayerName={setPlayerName} roomIdInput={roomIdInput} setRoomIdInput={setRoomIdInput}
                            handleCreateRoom={handleCreateRoom} handleJoinRoom={handleJoinRoom} error={error} isLoading={isLoading}
                        />
                    ) : displayStatus === 'lobby' ? (
                        <LobbyScreen
                            gameState={gameState} isHost={isHost} roomId={currentRoomId} myPeerId={myPeerIdRef.current}
                            updateSetting={(k, v) => updateGameState(prev => ({ ...prev, settings: { ...prev.settings, [k]: v } }))}
                            startGame={handleStartGame}
                            isLoading={isLoading}
                            handleKickPlayer={handleKickPlayer}
                            handleLeaveRoom={handleLeaveRoom}
                            productFetchError={productFetchError}
                        />
                    ) : displayStatus === 'playing' ? (
                        <GameScreen gameState={gameState} myPeerId={myPeerIdRef.current} submitGuess={submitGuess} handleLeaveRoom={handleLeaveRoom} sendLiveGuess={sendLiveGuess} />
                    ) : displayStatus === 'roundEnd' ? (
                        <RoundEndScreen gameState={gameState} myPeerId={myPeerIdRef.current} handleLeaveRoom={handleLeaveRoom} />
                    ) : displayStatus === 'result' ? (
                        <ResultScreen gameState={resultData || gameState} handleLeaveRoom={handleLeaveRoom} handleReturnToLobby={handleReturnToLobby} hostDisconnected={hostDisconnected} />
                    ) : null}
                </div>
            </div>

            {/* Emote Overlay & Controls */}
            {currentRoomId && (
                <>
                    {/* Active Emotes Rendering */}
                    {activeEmotes.map(emote => (
                        <div key={emote.id} className="fixed pointer-events-none z-50 animate-float-up flex flex-col items-center"
                            style={{ left: `${emote.left}%`, bottom: '120px' }}>
                            <span className="text-5xl md:text-7xl drop-shadow-2xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">{emote.emoji}</span>
                            <span className="text-xs font-bold bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1 rounded-full mt-2 border border-white/20 whitespace-nowrap shadow-lg">
                                {gameState.players[emote.senderId]?.name || '???'}
                            </span>
                        </div>
                    ))}

                    {/* Emote Button Menu */}
                    <EmoteMenu onEmote={handleSendEmote} />
                </>
            )}
        </>
    );
}

// --- UI Components ---

function TitleScreen({ playerName, setPlayerName, roomIdInput, setRoomIdInput, handleCreateRoom, handleJoinRoom, error, isLoading }) {
    const [tab, setTab] = useState('create');

    return (
        <div className="flex flex-col items-center justify-center mt-8 space-y-10 animate-fadeIn pb-12">
            <div className="animate-float text-center relative w-full">
                {/* タイトル背景の後光エフェクト */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[150%] bg-gradient-to-r from-transparent via-white/10 to-transparent blur-3xl rounded-full pointer-events-none"></div>

                <h1 className="text-5xl md:text-7xl lg:text-[4.5rem] font-black flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 relative z-10 tracking-tight leading-tight">
                    {/* アイコン部分をリッチなバッジ風に */}
                    <div className="bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 p-3 md:p-4 rounded-2xl md:rounded-3xl shadow-[0_10px_25px_rgba(0,0,0,0.4)] border border-yellow-200/60 transform -rotate-6 transition-transform hover:rotate-0 hover:scale-105">
                        <ShoppingCart className="w-12 h-12 md:w-16 md:h-16 text-white drop-shadow-md" strokeWidth={2.5} />
                    </div>
                    {/* タイトル文字をゴールドグラデーション＋ドロップシャドウに */}
                    <span
                        className="text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-300 to-amber-600 py-2"
                        style={{ filter: 'drop-shadow(0px 8px 12px rgba(0,0,0,0.6))' }}
                    >
                        楽天プライスゲッサー
                    </span>
                </h1>

                <div className="mt-6 flex items-center justify-center gap-3 md:gap-4 relative z-10">
                    <div className="h-0.5 w-8 md:w-16 bg-gradient-to-r from-transparent to-yellow-300 rounded-full"></div>
                    <p className="text-sm md:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-200 tracking-[0.1em] md:tracking-[0.2em] whitespace-nowrap"
                        style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' }}>
                        あなたの金銭感覚、バグってない？
                    </p>
                    <div className="h-0.5 w-8 md:w-16 bg-gradient-to-l from-transparent to-yellow-300 rounded-full"></div>
                </div>
            </div>

            <div className="panel w-full max-w-2xl overflow-hidden flex flex-col border-none bg-white/95 mt-4">
                {/* Tabs */}
                <div className="flex bg-slate-50 border-b border-slate-200">
                    <button
                        className={`flex-1 py-4 text-lg font-bold transition-all ${tab === 'create' ? 'bg-white text-red-600 shadow-[0_2px_0_#ef4444_inset]' : 'text-slate-500 hover:bg-slate-100'} border-r border-slate-200`}
                        onClick={() => setTab('create')}>
                        部屋を作る
                    </button>
                    <button
                        className={`flex-1 py-4 text-lg font-bold transition-all ${tab === 'join' ? 'bg-white text-red-600 shadow-[0_2px_0_#ef4444_inset]' : 'text-slate-500 hover:bg-slate-100'}`}
                        onClick={() => setTab('join')}>
                        部屋に入る
                    </button>
                </div>

                <div className="p-8 flex flex-col md:flex-row gap-8 items-center">
                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-xl flex items-center justify-center animate-pulse-pop shrink-0 border-4 border-white">
                        <User className="w-14 h-14 text-white drop-shadow-md" />
                    </div>

                    <div className="flex-1 space-y-6 w-full">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 font-bold shadow-sm">
                                <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-slate-700 font-bold mb-2 text-sm uppercase tracking-wider">ニックネーム</label>
                            <input
                                type="text" maxLength={10} placeholder="名前を入力"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white transition-all shadow-inner"
                                value={playerName} onChange={(e) => setPlayerName(e.target.value)}
                            />
                        </div>

                        {tab === 'join' && (
                            <div className="animate-fadeIn">
                                <label className="block text-slate-700 font-bold mb-2 text-sm uppercase tracking-wider">ルームID</label>
                                <input
                                    type="text" maxLength={5} placeholder="英数字5文字"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 uppercase tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white transition-all shadow-inner"
                                    value={roomIdInput} onChange={(e) => setRoomIdInput(e.target.value)}
                                />
                            </div>
                        )}

                        <button
                            onClick={tab === 'create' ? handleCreateRoom : handleJoinRoom}
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-bold py-4 rounded-xl text-xl btn-solid flex justify-center items-center gap-2 mt-2 shadow-lg"
                        >
                            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Play className="w-6 h-6 fill-current" /> {tab === 'create' ? '開始する' : '参加する'}</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* 遊び方セクション */}
            <div className="panel w-full max-w-2xl p-6 md:p-8 mt-4 border-none bg-white/95">
                <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-200 pb-4">
                    <Info className="w-6 h-6 text-indigo-500" strokeWidth={2.5} /> このゲームの遊び方
                </h2>
                <div className="space-y-4">
                    <div className="flex gap-4 items-start p-2">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg shrink-0 shadow-sm border border-indigo-200">1</div>
                        <div>
                            <h3 className="font-bold text-slate-800">部屋を作って集まる</h3>
                            <p className="text-slate-600 font-medium mt-1 text-sm leading-relaxed">代表者が「部屋を作る」からルームを作成し、表示されたIDを友達に共有しよう。他の人は「部屋に入る」からIDを入力して合流！</p>
                        </div>
                    </div>
                    <div className="flex gap-4 items-start p-2">
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-lg shrink-0 shadow-sm border border-rose-200">2</div>
                        <div>
                            <h3 className="font-bold text-slate-800">商品の値段を予想する</h3>
                            <p className="text-slate-600 font-medium mt-1 text-sm leading-relaxed">ゲームが始まると楽天市場の実際の商品が表示されます。画像や説明文から推測して、ズバリいくらか金額を入力！</p>
                        </div>
                    </div>
                    <div className="flex gap-4 items-start p-2">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-lg shrink-0 shadow-sm border border-amber-200">3</div>
                        <div>
                            <h3 className="font-bold text-slate-800">結果発表＆スコア獲得</h3>
                            <p className="text-slate-600 font-medium mt-1 text-sm leading-relaxed">実際の販売価格に一番近いほど高得点！指定したラウンド数を戦って、合計スコアが一番高い人が優勝です🏆</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* モード紹介セクション */}
            <div className="panel w-full max-w-2xl bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8 mt-4 border border-white">
                <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-200 pb-4">
                    <Trophy className="w-6 h-6 text-amber-500" strokeWidth={2.5} /> ゲームモードの紹介
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-emerald-600 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />通常モード</h3>
                        <p className="text-slate-500 font-medium mt-2 text-xs leading-relaxed">正解の金額に一番近い予想をした人が高得点をもらえるスタンダードなルール。</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-rose-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />ドボンモード</h3>
                        <p className="text-slate-500 font-medium mt-2 text-xs leading-relaxed">正解の金額を「1円でもオーバー」するとドボンとなり0ポイント！チキンレースを楽しもう。</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-blue-600 flex items-center gap-2"><ArrowUpCircle className="w-5 h-5" />ハイ＆ロー</h3>
                        <p className="text-slate-500 font-medium mt-2 text-xs leading-relaxed">表示された基準価格よりも「高い」か「安い」かの2択で答えるシンプルモード！</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-amber-500 flex items-center gap-2"><Crown className="w-5 h-5" />セレブモード</h3>
                        <p className="text-slate-500 font-medium mt-2 text-xs leading-relaxed">出題されるのが5万円以上の高額商品ばかりに！金銭感覚が狂うこと間違いなし。</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LobbyScreen({ gameState, isHost, roomId, myPeerId, updateSetting, startGame, isLoading, handleKickPlayer, handleLeaveRoom, productFetchError }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const textArea = document.createElement("textarea");
        textArea.value = roomId;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) { console.error('Copy failed', err); }
        document.body.removeChild(textArea);
    };

    const playersEntries = Object.entries(gameState.players);
    const emptySlots = Array(Math.max(0, 14 - playersEntries.length)).fill(null);

    return (
        <div className="flex flex-col items-center w-full mt-4 animate-fadeIn pb-12">
            {/* Header Info */}
            <div className="w-full flex flex-col md:flex-row justify-between items-center mb-6 px-2 gap-4 animate-float relative">
                {/* LOBBY文字の背景後光エフェクト */}
                <div className="absolute top-1/2 left-1/2 md:left-24 -translate-x-1/2 md:translate-x-0 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-3xl rounded-full pointer-events-none hidden md:block"></div>

                <h2 className="text-4xl md:text-5xl font-black flex items-center gap-4 relative z-10 tracking-widest">
                    <div className="bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 p-2 md:p-3 rounded-xl md:rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.4)] border border-yellow-200/60 transform -rotate-6 transition-transform hover:rotate-0 hover:scale-105">
                        <Settings className="w-8 h-8 md:w-10 md:h-10 text-white drop-shadow-md" strokeWidth={2.5} />
                    </div>
                    <span
                        className="text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-300 to-amber-600 py-2"
                        style={{ filter: 'drop-shadow(0px 6px 10px rgba(0,0,0,0.6))' }}
                    >
                        LOBBY
                    </span>
                </h2>
                <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end relative z-10">
                    <LeaveButton onLeave={handleLeaveRoom} />
                    <div className="bg-white/90 backdrop-blur-md border border-white/50 px-6 py-2 rounded-2xl flex items-center gap-4 shadow-lg">
                        <span className="font-bold text-xl text-slate-800">ID: <span className="tracking-widest ml-1">{roomId}</span></span>
                        <button
                            onClick={handleCopy}
                            className={`p-2 rounded-xl transition-all shadow-sm ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                            title="ルームIDをコピー"
                        >
                            {copied ? <Check strokeWidth={2.5} size={20} /> : <Copy strokeWidth={2.5} size={20} />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="panel w-full bg-white/95 overflow-hidden flex flex-col md:flex-row md:h-[650px] p-1 gap-1">
                {/* Left: Players */}
                <div className="w-full md:w-1/3 flex flex-col bg-slate-50 rounded-xl border border-slate-100 overflow-hidden h-[350px] md:h-full">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold p-4 text-center text-sm tracking-wider uppercase shadow-md relative z-10">
                        プレイヤー {playersEntries.length} / 14
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {playersEntries.map(([id, p]) => (
                            <div key={id} className={`bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-slate-100 transition-all ${id === myPeerId ? 'ring-2 ring-indigo-400 ring-offset-2 scale-[1.02]' : 'hover:shadow-md'}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-inner ${id === myPeerId ? 'bg-gradient-to-br from-rose-400 to-red-500' : 'bg-gradient-to-br from-indigo-400 to-purple-500'}`}>
                                    {p.name.charAt(0)}
                                </div>
                                <span className="font-bold text-slate-800 flex-1 truncate">{p.name}</span>
                                {p.isHost && <Crown className="text-amber-400 w-6 h-6 mr-1 drop-shadow-sm fill-current" />}

                                {!p.isHost && isHost && (
                                    <button
                                        onClick={() => handleKickPlayer(id)}
                                        className="bg-rose-50 hover:bg-rose-100 text-rose-500 p-2 rounded-lg transition-transform hover:scale-110"
                                        title="このプレイヤーを退出させる"
                                    >
                                        <X strokeWidth={2.5} size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {emptySlots.map((_, i) => (
                            <div key={`empty-${i}`} className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 border border-slate-200 border-dashed opacity-60">
                                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-slate-400" />
                                </div>
                                <span className="font-medium text-slate-400 flex-1">参加待ち...</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Settings */}
                <div className="w-full md:w-2/3 flex flex-col bg-white rounded-xl h-full">
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
                        <SettingRow icon={<Crown size={24} strokeWidth={2.5} className="text-amber-500" />} title="ゲームモード" desc="遊び方のルールを選択">
                            <div className="flex flex-col gap-2">
                                <select disabled={!isHost} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800 transition-all shadow-inner appearance-none cursor-pointer" value={gameState.settings.gameMode} onChange={(e) => updateSetting('gameMode', e.target.value)}>
                                    <option value="normal">通常モード</option>
                                    <option value="dobon">ドボンモード</option>
                                    <option value="highlow">ハイ＆ローモード</option>
                                    <option value="celeb">セレブモード</option>
                                </select>
                                <div className="text-xs font-medium text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-100 leading-relaxed shadow-sm">
                                    {gameState.settings.gameMode === 'normal' && '💡 正解の金額に一番近い人が高得点を獲得するスタンダードルール！'}
                                    {gameState.settings.gameMode === 'dobon' && '💡 正解を1円でもオーバーするとドボンで0点！ギリギリを攻めろ！'}
                                    {gameState.settings.gameMode === 'highlow' && '💡 基準価格より「高い」か「安い」かの2択！サクサク遊べます。'}
                                    {gameState.settings.gameMode === 'celeb' && '💡 5万円以上の高級品ばかりが登場！金銭感覚を狂わせろ！'}
                                </div>
                            </div>
                        </SettingRow>

                        <SettingRow icon={<ShoppingCart size={24} strokeWidth={2.5} className="text-emerald-500" />} title="出題ジャンル" desc="商品のカテゴリを絞り込みます">
                            <select disabled={!isHost} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800 transition-all shadow-inner appearance-none cursor-pointer" value={gameState.settings.genreId} onChange={(e) => updateSetting('genreId', e.target.value)}>
                                <option value="0">すべてのジャンル</option>
                                <option value="100227">食品・スイーツ</option>
                                <option value="100371">レディースファッション</option>
                                <option value="551177">メンズファッション</option>
                                <option value="100939">美容・コスメ・香水</option>
                                <option value="100804">インテリア・寝具・収納</option>
                                <option value="562637">家電</option>
                                <option value="101070">スポーツ・アウトドア</option>
                                <option value="101164">おもちゃ・ゲーム</option>
                                <option value="200162">本・雑誌・コミック</option>
                            </select>
                        </SettingRow>

                        <SettingRow icon={<LinkIcon size={24} strokeWidth={2.5} className="text-blue-500" />} title="フリーワード" desc="好きなキーワードでさらに絞り込み (任意)">
                            <input type="text" disabled={!isHost} placeholder="例: キャンプ, 最新家電" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800 placeholder-slate-400 transition-all shadow-inner" value={gameState.settings.keyword || ''} onChange={(e) => updateSetting('keyword', e.target.value)} />
                        </SettingRow>

                        <SettingRow icon={<CheckCircle2 size={24} strokeWidth={2.5} className="text-rose-500" />} title="ラウンド数" desc="1ゲームの長さを選択">
                            <div className="flex gap-2">
                                {[3, 4, 5].map(r => (
                                    <button key={r} disabled={!isHost} onClick={() => updateSetting('rounds', r)} className={`flex-1 py-2 md:py-3 rounded-xl font-bold text-sm md:text-base transition-all ${gameState.settings.rounds === r ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>{r}回</button>
                                ))}
                            </div>
                        </SettingRow>

                        <SettingRow icon={<Clock size={24} strokeWidth={2.5} className="text-slate-600" />} title="制限時間" desc="1ラウンドあたりの予想時間">
                            <div className="grid grid-cols-4 gap-2">
                                {[15, 30, 60, 0].map(t => (
                                    <button key={t} disabled={!isHost} onClick={() => updateSetting('timeLimit', t)} className={`py-2 md:py-3 rounded-xl font-bold text-sm md:text-base transition-all ${gameState.settings.timeLimit === t ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>{t === 0 ? '無制限' : `${t}秒`}</button>
                                ))}
                            </div>
                        </SettingRow>

                        <SettingRow icon={<Star size={24} strokeWidth={2.5} className="text-amber-400 fill-current" />} title="最終ラウンドスコア2倍" desc="逆転のチャンスを作るかどうか">
                            <div className="flex gap-2">
                                <button disabled={!isHost} onClick={() => updateSetting('doubleFinalRound', true)} className={`flex-1 py-2 md:py-3 rounded-xl font-bold text-sm md:text-base transition-all ${gameState.settings.doubleFinalRound ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-md shadow-amber-200' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>ON</button>
                                <button disabled={!isHost} onClick={() => updateSetting('doubleFinalRound', false)} className={`flex-1 py-2 md:py-3 rounded-xl font-bold text-sm md:text-base transition-all ${!gameState.settings.doubleFinalRound ? 'bg-slate-400 text-white shadow-md' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>OFF</button>
                            </div>
                        </SettingRow>

                        <SettingRow icon={<Users size={24} strokeWidth={2.5} className="text-cyan-500" />} title="入力金額の共有" desc="他の人の予想金額をリアルタイムでチラ見せ">
                            <div className="flex gap-2">
                                <button disabled={!isHost} onClick={() => updateSetting('showLiveGuess', true)} className={`flex-1 py-2 md:py-3 rounded-xl font-bold text-sm md:text-base transition-all ${gameState.settings.showLiveGuess ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md shadow-cyan-200' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>ON</button>
                                <button disabled={!isHost} onClick={() => updateSetting('showLiveGuess', false)} className={`flex-1 py-2 md:py-3 rounded-xl font-bold text-sm md:text-base transition-all ${!gameState.settings.showLiveGuess ? 'bg-slate-400 text-white shadow-md' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>OFF</button>
                            </div>
                        </SettingRow>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl flex items-center justify-end gap-4 mt-auto">
                        {!isHost && <div className="text-slate-600 font-bold mr-auto flex items-center gap-2 animate-pulse"><Loader2 className="animate-spin text-indigo-500 w-5 h-5" /> ホストの開始を待機中...</div>}
                        {isHost && (
                            productFetchError ? (
                                <div className="flex flex-col md:flex-row gap-3 items-center w-full animate-fadeIn bg-rose-50 p-3 rounded-xl border border-rose-200">
                                    <span className="text-rose-600 font-bold text-sm flex items-center gap-1 shrink-0"><AlertTriangle className="w-5 h-5" /> 商品取得エラー</span>
                                    <div className="flex gap-2 w-full md:ml-auto justify-end">
                                        <button onClick={() => startGame(false)} disabled={isLoading} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm transition-all">
                                            {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <><RefreshCw className="w-4 h-4" />再試行</>}
                                        </button>
                                        <button onClick={() => startGame(true)} disabled={isLoading} className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md transition-all whitespace-nowrap">
                                            <Play className="w-4 h-4 fill-current" /> モックで開始
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => startGame(false)} disabled={isLoading || Object.keys(gameState.players).length < 1} className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xl py-3 px-12 rounded-xl btn-solid flex items-center justify-center gap-2">
                                    {isLoading ? <Loader2 className="animate-spin w-6 h-6" /> : <><Play className="fill-current w-6 h-6" /> ゲーム開始！</>}
                                </button>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SettingRow({ icon, title, desc, children }) {
    return (
        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors">
            <div className="flex items-center gap-4 w-full md:w-1/2">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm shrink-0">
                    {icon}
                </div>
                <div>
                    <div className="font-bold text-slate-800">{title}</div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">{desc}</div>
                </div>
            </div>
            <div className="w-full md:w-1/2">
                {children}
            </div>
        </div>
    );
}

function GameScreen({ gameState, myPeerId, submitGuess, handleLeaveRoom, sendLiveGuess }) {
    const [guessInput, setGuessInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(gameState.settings.timeLimit);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [showDoubleAnim, setShowDoubleAnim] = useState(false);
    const inputRef = useRef(null);

    const me = gameState.players[myPeerId];
    const currentProduct = gameState.products[gameState.currentRound];
    const displayImages = currentProduct?.images && currentProduct.images.length > 0 ? currentProduct.images : [currentProduct?.image];
    const isUnlimited = gameState.settings.timeLimit === 0;
    const isFinalRound = gameState.currentRound === gameState.settings.rounds - 1;
    const isHighLow = gameState.settings.gameMode === 'highlow';

    useEffect(() => {
        setSelectedImageIndex(0);
        setGuessInput('');

        if (isFinalRound && gameState.settings.doubleFinalRound) {
            setShowDoubleAnim(true);
            const timer = setTimeout(() => setShowDoubleAnim(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [gameState.currentRound, isFinalRound, gameState.settings.doubleFinalRound]);

    useEffect(() => {
        if (isUnlimited) return;
        const interval = setInterval(() => {
            setTimeLeft(Math.max(0, Math.ceil((gameState.roundEndTime - Date.now()) / 1000)));
        }, 200);
        return () => clearInterval(interval);
    }, [gameState.roundEndTime, isUnlimited]);

    useEffect(() => {
        if (!gameState.settings.showLiveGuess || isHighLow) return;
        if (me?.hasGuessed) return;

        const timeoutId = setTimeout(() => {
            sendLiveGuess(guessInput);
        }, 300);

        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guessInput, gameState.settings.showLiveGuess, me?.hasGuessed, isHighLow]);

    useEffect(() => {
        if (isHighLow) return;
        const handleWheel = (e) => {
            e.preventDefault();
            const delta = Math.sign(e.deltaY);
            setGuessInput(prev => {
                let currentVal = parseInt(prev, 10);
                if (isNaN(currentVal)) currentVal = 0;
                let newVal = currentVal - (delta * 100);
                if (newVal < 0) newVal = 0;
                return newVal.toString();
            });
        };

        const input = inputRef.current;
        if (input) {
            input.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (input) {
                input.removeEventListener('wheel', handleWheel);
            }
        };
    }, [isHighLow]);

    const onSubmit = (e) => {
        e.preventDefault();
        if (guessInput) submitGuess(guessInput);
    };

    if (!currentProduct) return null;

    return (
        <div className="w-full mt-4 flex flex-col items-center animate-fadeIn relative pb-24">
            {showDoubleAnim && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-gradient-to-br from-amber-400 to-yellow-500 border border-white/40 rounded-3xl p-8 md:p-12 transform -rotate-3 animate-pulse-pop shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        <h2 className="text-4xl md:text-5xl font-black text-rose-700 text-center drop-shadow-md leading-tight">
                            最終ラウンド！<br />
                            <span className="text-6xl md:text-8xl text-white block mt-4 transform rotate-2 drop-shadow-xl">
                                スコア2倍!!
                            </span>
                        </h2>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="w-full flex flex-wrap justify-between items-center mb-6 px-2 gap-4 animate-float">
                <div className="bg-white/90 backdrop-blur-md border border-white/50 text-slate-800 font-bold text-lg md:text-xl px-6 py-2 rounded-full shadow-lg flex items-center">
                    ラウンド <span className="text-indigo-600 text-2xl md:text-3xl font-black mx-2">{gameState.currentRound + 1}</span> <span className="text-slate-400">/ {gameState.settings.rounds}</span>
                    {gameState.settings.doubleFinalRound && isFinalRound && (
                        <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-xs md:text-sm px-3 py-1 rounded-full ml-3 font-black shadow-md animate-pulse-pop shrink-0">スコア2倍!!</span>
                    )}
                </div>
                <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
                    <LeaveButton onLeave={handleLeaveRoom} />
                    <div className={`backdrop-blur-md border border-white/50 font-black text-2xl md:text-3xl flex items-center gap-2 px-6 py-2 rounded-full shadow-lg transition-colors ${!isUnlimited && timeLeft <= 5 ? 'animate-pulse bg-rose-50 text-rose-600' : 'bg-white/90 text-slate-800'}`}>
                        <Clock className="w-6 h-6 md:w-8 md:h-8" /> {isUnlimited ? '∞' : `${timeLeft}秒`}
                    </div>
                </div>
            </div>

            <div className="panel w-full p-4 md:p-6 flex flex-col gap-6">
                {/* Image & Title Container */}
                <div className="flex flex-col md:flex-row gap-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    {/* Images */}
                    <div className="w-full md:w-1/2 flex flex-col items-center gap-4">
                        <div className="w-full aspect-square bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden p-4 relative shadow-inner border border-slate-100">
                            <img src={displayImages[selectedImageIndex]} className="max-w-full max-h-full object-contain drop-shadow-md animate-fadeIn" />
                        </div>
                        {displayImages.length > 1 && (
                            <div className="flex gap-3 w-full justify-center">
                                {displayImages.map((img, i) => (
                                    <button key={i} onClick={() => setSelectedImageIndex(i)} className={`w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden bg-white transition-all hover:-translate-y-1 ${selectedImageIndex === i ? 'ring-2 ring-indigo-500 ring-offset-2 shadow-md' : 'border border-slate-200 opacity-70 hover:opacity-100'}`}>
                                        <img src={img} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 justify-center">
                            {currentProduct.tags.map((tag, i) => (
                                <span key={i} className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-xs font-bold px-3 py-1 rounded-full shadow-sm">{tag}</span>
                            ))}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="w-full md:w-1/2 flex flex-col gap-4">
                        <h3 className="text-xl md:text-2xl font-bold leading-relaxed text-slate-800 bg-gradient-to-r from-slate-50 to-white p-4 rounded-xl shadow-sm border border-slate-100">{currentProduct.name}</h3>
                        {currentProduct.reviewCount > 0 && (
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 w-max shadow-sm">
                                <Star className="w-5 h-5 text-amber-400 fill-current" />
                                <span className="text-lg font-black text-slate-800">{currentProduct.reviewAverage}</span>
                                <span className="text-slate-400 text-sm font-medium">({currentProduct.reviewCount.toLocaleString()})</span>
                            </div>
                        )}
                        <div className="flex-1 bg-slate-50 p-5 rounded-2xl border border-slate-100 overflow-y-auto custom-scrollbar text-sm font-medium text-slate-600 max-h-48 md:max-h-80 shadow-inner whitespace-pre-wrap leading-relaxed">
                            {currentProduct.description}
                        </div>
                    </div>
                </div>

                {/* Input Area */}
                <div className="w-full bg-gradient-to-br from-slate-800 to-slate-900 p-6 md:p-8 rounded-3xl shadow-xl flex flex-col justify-center border border-slate-700 relative overflow-hidden">
                    {/* Decorative Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>

                    {me?.hasGuessed ? (
                        <div className="text-center py-6 text-white relative z-10 animate-fadeIn">
                            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-3 drop-shadow-md" />
                            <h3 className="text-3xl font-black drop-shadow-md">予想完了！</h3>
                            <p className="font-medium mt-3 text-slate-300">
                                {Object.keys(gameState.players).length > 1 ? "他のプレイヤーを待っています..." : "まもなく正解発表です..."}
                            </p>
                        </div>
                    ) : isHighLow ? (
                        <div className="flex flex-col items-center gap-6 w-full relative z-10">
                            <div className="text-lg md:text-xl font-bold text-slate-300 mb-2 text-center">
                                実際の価格は、基準価格 <span className="text-amber-400 font-black text-3xl md:text-4xl mx-2 bg-black/40 px-4 py-1.5 rounded-xl border border-white/10 shadow-inner">¥{currentProduct.basePrice.toLocaleString()}</span> より...
                            </div>
                            <div className="flex w-full gap-4 md:gap-8 max-w-xl mx-auto">
                                <button
                                    onClick={() => submitGuess('high')}
                                    disabled={me?.hasGuessed}
                                    className="flex-1 bg-gradient-to-b from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-black py-5 md:py-6 rounded-2xl text-2xl md:text-3xl btn-solid shadow-lg flex items-center justify-center gap-2"
                                >
                                    <ArrowUpCircle size={32} /> 高い
                                </button>
                                <button
                                    onClick={() => submitGuess('low')}
                                    disabled={me?.hasGuessed}
                                    className="flex-1 bg-gradient-to-b from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black py-5 md:py-6 rounded-2xl text-2xl md:text-3xl btn-solid shadow-lg flex items-center justify-center gap-2"
                                >
                                    <ArrowDownCircle size={32} /> 安い
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={onSubmit} className="flex flex-col md:flex-row items-center gap-4 w-full relative z-10 max-w-3xl mx-auto">
                            <div className="flex items-center gap-3 flex-1 w-full bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 px-6 py-4 shadow-inner">
                                <span className="text-3xl md:text-4xl font-black text-amber-400 drop-shadow-md">¥</span>
                                <input
                                    ref={inputRef}
                                    type="number" autoFocus placeholder="ズバリ、いくら？"
                                    min="0"
                                    className="flex-1 w-full bg-transparent text-3xl md:text-4xl font-bold text-white focus:outline-none text-right py-2 placeholder-white/30"
                                    value={guessInput}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || Number(val) >= 0) setGuessInput(val);
                                    }}
                                />
                            </div>
                            <button
                                type="submit" disabled={!guessInput}
                                className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black py-5 px-12 rounded-2xl text-2xl btn-solid shadow-lg whitespace-nowrap"
                            >決定！</button>
                        </form>
                    )}
                </div>

                {/* Live Guess Area */}
                {gameState.settings.showLiveGuess && !isHighLow && (
                    <div className="w-full bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mt-2 animate-fadeIn">
                        <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider"><Users size={18} className="text-indigo-500" /> みんなの入力状況</h4>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(gameState.players).map(([id, p]) => (
                                <div key={id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${p.hasGuessed ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'} ${id === myPeerId ? 'ring-2 ring-indigo-300 ring-offset-1' : ''}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${id === myPeerId ? 'bg-gradient-to-br from-rose-400 to-red-500' : 'bg-gradient-to-br from-indigo-400 to-purple-500'}`}>
                                        {p.name.charAt(0)}
                                    </div>
                                    <span className="font-bold text-sm text-slate-700">{p.name}</span>
                                    <span className={`font-black ml-1 ${p.hasGuessed ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                        {p.hasGuessed ? `¥${Number(p.currentGuess).toLocaleString()}!` : (p.liveGuess ? `¥${Number(p.liveGuess).toLocaleString()}?` : <span className="text-slate-400 text-sm">考え中...</span>)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function RoundEndScreen({ gameState, myPeerId, handleLeaveRoom }) {
    const currentProduct = gameState.products[gameState.currentRound];
    const sortedPlayers = Object.entries(gameState.players).sort((a, b) => b[1].lastPoints - a[1].lastPoints);
    const isFinalRound = gameState.currentRound === gameState.settings.rounds - 1;
    const isHighLow = gameState.settings.gameMode === 'highlow';

    return (
        <div className="mt-8 flex flex-col items-center w-full animate-fadeIn relative pb-24">
            <div className="w-full flex justify-end px-2 mb-4 md:-mb-8 z-20">
                <LeaveButton onLeave={handleLeaveRoom} />
            </div>
            <div className="animate-float z-10 -mb-6 flex flex-col items-center">
                {gameState.settings.doubleFinalRound && isFinalRound && (
                    <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white font-black text-xl md:text-3xl px-8 py-2 rounded-full shadow-lg mb-4 transform rotate-2 animate-pulse-pop border border-white/50">
                        🔥 最終ラウンド 獲得スコア2倍!! 🔥
                    </div>
                )}
                <h2 className="text-5xl md:text-6xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] transform -rotate-2 tracking-widest">
                    正解発表！
                </h2>
            </div>

            <div className="panel w-full max-w-2xl bg-white p-8 flex flex-col items-center relative text-center pt-12 mt-4 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>

                {isHighLow && (
                    <div className="text-lg font-bold text-slate-500 mb-3 bg-slate-50 px-4 py-1 rounded-full border border-slate-100">
                        基準価格: <span className="text-slate-800">¥{currentProduct.basePrice.toLocaleString()}</span>
                    </div>
                )}

                <img src={currentProduct.image} className="w-48 h-48 md:w-64 md:h-64 object-contain mb-6 bg-slate-50 rounded-2xl shadow-inner border border-slate-100 p-4" />
                <h3 className="text-xl md:text-2xl font-bold mb-2 text-slate-800 leading-relaxed">{currentProduct.name}</h3>
                <p className="text-slate-400 font-medium mt-2 text-sm uppercase tracking-wider">気になる正解は...</p>

                <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-rose-500 to-red-700 my-6 drop-shadow-sm animate-pulse-pop">
                    ¥{currentProduct.price.toLocaleString()}
                </div>
            </div>

            <div className="w-full max-w-2xl space-y-4 mt-8">
                {sortedPlayers.map(([id, p], index) => {
                    let guessDisplay = '時間切れ';
                    let diffDisplay = null;

                    if (isHighLow) {
                        if (p.currentGuess === 'high') guessDisplay = 'High (高い)';
                        if (p.currentGuess === 'low') guessDisplay = 'Low (安い)';
                    } else if (p.hasGuessed) {
                        guessDisplay = `¥${Number(p.currentGuess).toLocaleString()}`;
                        diffDisplay = `(誤差 ¥${Math.abs(Number(p.currentGuess) - currentProduct.price).toLocaleString()})`;
                    }

                    return (
                        <div key={id} className={`flex items-center gap-4 bg-white rounded-2xl p-5 transition-all ${id === myPeerId ? 'shadow-lg border-2 border-indigo-400 transform scale-[1.02]' : 'shadow-sm border border-slate-100'}`}>
                            <div className="w-10 text-center font-black text-slate-300 text-2xl">{index + 1}</div>
                            <div className="flex-1">
                                <div className="font-bold text-xl text-slate-800">{p.name}</div>
                                <div className="text-sm text-slate-500 font-medium mt-1.5 flex flex-wrap items-center gap-2">
                                    <span>予想:</span>
                                    <span className={`text-lg font-bold ${p.isDobon ? 'text-slate-400 line-through' : 'text-indigo-600'}`}>{guessDisplay}</span>
                                    {diffDisplay && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-md border border-slate-200">{diffDisplay}</span>}
                                    {p.isDobon && <span className="text-xs bg-gradient-to-r from-rose-500 to-red-600 text-white px-2 py-1 rounded-md shadow-sm font-bold animate-pulse-pop">ドボン!!</span>}
                                    {isHighLow && p.hasGuessed && (
                                        <span className={`text-xs px-2 py-1 rounded-md font-bold text-white shadow-sm ${p.lastPoints > 0 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-slate-400'}`}>
                                            {p.lastPoints > 0 ? '正解！' : '不正解...'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="font-black text-3xl text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-green-600 drop-shadow-sm">+{p.lastPoints}</div>
                                <div className="text-[10px] font-bold text-slate-400 mt-1 mb-1.5 uppercase tracking-wider">獲得スコア</div>
                                <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 shadow-sm">累計: {p.score}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="mt-12 font-bold text-white/80 text-xl animate-pulse tracking-widest">次のラウンドへ進みます...</p>
        </div>
    );
}

function ResultScreen({ gameState, handleLeaveRoom, handleReturnToLobby, hostDisconnected }) {
    const sortedPlayers = Object.entries(gameState.players).sort((a, b) => b[1].score - a[1].score);

    const rankColors = [
        'bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 text-white shadow-lg shadow-yellow-500/40 border border-yellow-200',
        'bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 text-white shadow-lg shadow-slate-400/40 border border-slate-200',
        'bg-gradient-to-br from-orange-300 via-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/40 border border-orange-200',
        'bg-slate-100 text-slate-400 border border-slate-200'
    ];

    return (
        <div className="mt-8 flex flex-col items-center pb-32 animate-fadeIn">
            <div className="animate-float z-10 -mb-8">
                <h2 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] mb-8 flex items-center gap-4 transform -rotate-2">
                    <Trophy className="w-16 h-16 md:w-20 md:h-20 text-yellow-400 drop-shadow-lg" /> 最終結果
                </h2>
            </div>

            <div className="w-full max-w-3xl flex flex-col gap-4 mb-12 bg-white/95 panel p-6 md:p-10 pt-16 mt-4 border-none">
                {sortedPlayers.map(([id, p], index) => (
                    <div key={id} className={`flex items-center gap-6 bg-white rounded-2xl p-5 md:p-6 transition-all ${index === 0 ? 'shadow-xl border border-yellow-200 transform scale-[1.03] z-10 animate-pulse-pop bg-gradient-to-r from-yellow-50/50 to-white' : 'shadow-sm border border-slate-100'}`}>
                        <div className={`w-14 h-14 md:w-16 md:h-16 flex items-center justify-center rounded-full font-black text-2xl md:text-3xl ${rankColors[index] || rankColors[3]}`}>
                            {index + 1}
                        </div>
                        <div className="flex-1 text-2xl md:text-3xl font-bold text-slate-800">{p.name}</div>
                        <div className="text-right">
                            <div className={`text-4xl md:text-5xl font-black text-transparent bg-clip-text ${index === 0 ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-slate-600 to-slate-800'} drop-shadow-sm`}>{p.score}</div>
                            <div className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">トータルスコア</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="panel w-full max-w-3xl bg-slate-50/95 p-6 md:p-8 border-none">
                <h3 className="text-xl font-black text-slate-800 mb-6 text-center border-b border-slate-200 pb-4">登場した商品</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {gameState.products.map((prod, i) => (
                        <div key={i} className="bg-white rounded-2xl p-5 flex flex-col gap-4 shadow-sm border border-slate-100 transition-transform hover:-translate-y-1 hover:shadow-md group">
                            <div className="flex gap-4">
                                <div className="w-24 h-24 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 p-2">
                                    <img src={prod.image} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <h4 className="font-bold text-sm line-clamp-2 leading-snug text-slate-700 group-hover:text-indigo-600 transition-colors">{prod.name}</h4>
                                    {prod.reviewCount > 0 && (
                                        <div className="flex items-center gap-1 text-amber-500 text-xs font-bold mt-1.5">
                                            <Star className="w-4 h-4 fill-current" />
                                            <span>{prod.reviewAverage}</span>
                                            <span className="text-slate-400 font-medium ml-1">({prod.reviewCount.toLocaleString()})</span>
                                        </div>
                                    )}
                                    <p className="text-rose-600 font-black mt-2 text-lg">¥{prod.price.toLocaleString()}</p>
                                </div>
                            </div>
                            <a
                                href={prod.url} target="_blank" rel="noopener noreferrer"
                                className="w-full bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-indigo-600 font-bold py-3 rounded-xl flex justify-center items-center gap-2 transition-all text-sm"
                            >
                                <LinkIcon strokeWidth={2.5} size={18} /> 楽天市場で見る
                            </a>
                        </div>
                    ))}
                </div>
            </div>

            {/* ナビゲーションボタン群 */}
            <div className="mt-12 flex flex-col items-center gap-6 w-full">
                <div className="flex flex-col md:flex-row gap-4 justify-center w-full max-w-2xl px-4">
                    {!hostDisconnected && (
                        <button
                            onClick={handleReturnToLobby}
                            className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-2xl text-lg md:text-xl btn-solid shadow-lg flex items-center justify-center gap-3"
                        >
                            <Users strokeWidth={2.5} /> ロビーへ戻る
                        </button>
                    )}
                    <button
                        onClick={handleLeaveRoom}
                        className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold py-4 px-6 rounded-2xl text-lg md:text-xl btn-solid shadow-lg flex items-center justify-center gap-3"
                    >
                        <Home strokeWidth={2.5} /> タイトルへ戻る
                    </button>
                </div>

                {hostDisconnected && (
                    <div className="font-bold text-rose-700 bg-rose-50 px-6 py-4 rounded-xl border border-rose-200 shadow-sm text-center w-full max-w-lg animate-pulse-pop flex flex-col gap-2 mt-4">
                        <AlertTriangle className="w-8 h-8 mx-auto" strokeWidth={2.5} />
                        <p className="text-sm">ホストが退出したため、ロビーには戻れません。<br />商品の確認が終わったらタイトルへ戻ってください。</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function LeaveButton({ onLeave }) {
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (confirming) {
            const timer = setTimeout(() => setConfirming(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [confirming]);

    if (confirming) {
        return (
            <button
                onClick={onLeave}
                className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-bold px-4 py-2 rounded-xl shadow-md flex items-center gap-2 animate-pulse-pop shrink-0 transition-all border border-red-400"
            >
                <LogOut size={20} strokeWidth={2.5} /> 退出する！
            </button>
        );
    }

    return (
        <button
            onClick={() => setConfirming(true)}
            className="bg-white/80 hover:bg-white text-slate-600 font-bold px-4 py-2 rounded-xl shadow-sm border border-white/50 flex items-center gap-2 transition-all shrink-0 backdrop-blur-sm"
        >
            <LogOut size={20} strokeWidth={2.5} /> 退出
        </button>
    );
}

function EmoteMenu({ onEmote }) {
    const [isOpen, setIsOpen] = useState(false);
    const emojis = ['😲', '💸', '🤑', '😭', '👏', '🤔'];

    return (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3">
            {isOpen && (
                <div className="flex flex-col gap-2 bg-white/90 p-2 rounded-full border border-slate-200 shadow-xl animate-fadeIn backdrop-blur-md">
                    {emojis.map(e => (
                        <button key={e} onClick={() => { onEmote(e); setIsOpen(false); }} className="text-3xl w-12 h-12 flex items-center justify-center hover:scale-125 transition-transform hover:bg-slate-100 rounded-full">
                            {e}
                        </button>
                    ))}
                </div>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 border-2 border-white/50 ${isOpen ? 'bg-slate-100 text-slate-600' : 'bg-gradient-to-br from-amber-300 to-yellow-500 text-white'}`}
            >
                {isOpen ? <X size={32} strokeWidth={2.5} /> : <MessageCircle size={32} fill="currentColor" strokeWidth={2} className="text-white drop-shadow-sm" />}
            </button>
        </div>
    );
}