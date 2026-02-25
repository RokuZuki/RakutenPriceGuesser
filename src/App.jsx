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

    // P2P States & Refs
    const peerRef = useRef(null);
    const connRef = useRef(null);
    const hostConnectionsRef = useRef([]);
    const myPeerIdRef = useRef(null);

    // Game State
    const initialGameState = {
        status: 'lobby', // lobby, playing, roundEnd, result
        settings: { genreId: '0', timeLimit: 30, rounds: 3, keyword: '', doubleFinalRound: true, showLiveGuess: false, gameMode: 'normal' },
        currentRound: 0,
        products: [],
        players: {},
        roundEndTime: 0,
        nextRoundStartTime: 0
    };
    const [gameState, setGameState] = useState(initialGameState);
    const gameStateRef = useRef(initialGameState);

    // 画面遷移時に一番上にスクロールする処理 ＋ URLハッシュによる擬似ページ分割
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        let targetHash = '#title';
        if (currentRoomId) {
            if (gameState.status === 'lobby') targetHash = '#lobby';
            else if (gameState.status === 'playing' || gameState.status === 'roundEnd') targetHash = '#battle';
            else if (gameState.status === 'result') targetHash = '#result';
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
    }, [gameState.status, currentRoomId]);

    // ブラウザの「戻る」「進む」ボタンに対する安全対策
    useEffect(() => {
        const handlePopState = () => {
            if (currentRoomId) window.location.reload();
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [currentRoomId]);

    // UI Styles & Animations Injection
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;900&display=swap');
      
      body {
        font-family: 'M PLUS Rounded 1c', sans-serif;
        color: #450a0a;
        overflow-x: hidden;
      }
      
      /* Animated Background Pattern Base */
      .bg-animated-pattern {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: -1;
        transition: background-color 0.5s ease;
      }
      
      @keyframes scrollBg {
        0% { background-position: 0 0, 20px 20px; }
        100% { background-position: 60px 60px, 80px 80px; }
      }
      @keyframes scrollBgDiag {
        0% { background-position: 0 0; }
        100% { background-position: 56.56px 56.56px; }
      }
      @keyframes scrollBgSlow {
        0% { background-position: 0 0, 30px 30px; }
        100% { background-position: 60px 60px, 90px 90px; }
      }
      
      /* Normal Mode (Dots) */
      .bg-pattern-normal {
        background-color: #ef4444;
        background-image: radial-gradient(#b91c1c 5px, transparent 5px);
        background-size: 30px 30px;
        animation: scrollBg 2s linear infinite;
      }
      
      /* Dobon Mode (Stripes / Danger) */
      .bg-pattern-dobon {
        background-color: #ef4444;
        background-image: repeating-linear-gradient(-45deg, transparent, transparent 10px, #b91c1c 10px, #b91c1c 20px);
        background-size: 28.28px 28.28px;
        animation: scrollBgDiag 1s linear infinite;
      }

      /* HighLow Mode (Checkerboard) */
      .bg-pattern-highlow {
        background-color: #ef4444;
        background-image: linear-gradient(45deg, #b91c1c 25%, transparent 25%, transparent 75%, #b91c1c 75%, #b91c1c), linear-gradient(45deg, #b91c1c 25%, transparent 25%, transparent 75%, #b91c1c 75%, #b91c1c);
        background-size: 40px 40px;
        background-position: 0 0, 20px 20px;
        animation: scrollBg 2.5s linear infinite;
      }

      /* Celeb Mode (Diamonds / Gold accents) */
      .bg-pattern-celeb {
        background-color: #ef4444;
        background-image: radial-gradient(circle at 15px 15px, #fbd38d 3px, transparent 4px), radial-gradient(circle at 45px 45px, #fbbf24 2px, transparent 3px);
        background-size: 60px 60px;
        animation: scrollBgSlow 4s linear infinite;
      }
      
      /* Solid Panels & Borders */
      .panel-border { border: 4px solid #450a0a; }
      .panel {
        background-color: white;
        border: 4px solid #450a0a;
        border-radius: 1.5rem;
        box-shadow: 0 8px 0 #450a0a;
      }
      .panel-inset { box-shadow: inset 0 4px 0 rgba(0,0,0,0.1); }
      
      /* Solid Buttons */
      .btn-solid {
        border: 4px solid #450a0a;
        box-shadow: 0 6px 0 #450a0a;
        transition: transform 0.1s, box-shadow 0.1s;
      }
      .btn-solid:active:not(:disabled) {
        transform: translateY(6px);
        box-shadow: 0 0px 0 #450a0a;
      }
      .btn-solid:disabled { opacity: 0.6; cursor: not-allowed; }
      
      /* Text Strokes */
      .text-stroke { text-shadow: -2px -2px 0 #450a0a, 2px -2px 0 #450a0a, -2px 2px 0 #450a0a, 2px 2px 0 #450a0a; }
      .text-stroke-sm { text-shadow: -1px -1px 0 #450a0a, 1px -1px 0 #450a0a, -1px 1px 0 #450a0a, 1px 1px 0 #450a0a; }
      
      /* Animations */
      @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      .animate-float { animation: float 3s ease-in-out infinite; }
      
      @keyframes pulse-pop { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      .animate-pulse-pop { animation: pulse-pop 2s infinite; }

      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }

      @keyframes float-up {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          20% { transform: translateY(-30px) scale(1.2); opacity: 1; }
          80% { transform: translateY(-100px) scale(1); opacity: 1; }
          100% { transform: translateY(-130px) scale(0.8); opacity: 0; }
      }
      .animate-float-up { animation: float-up 2.5s ease-out forwards; }
      
      /* Custom Scrollbar */
      .custom-scrollbar::-webkit-scrollbar { width: 12px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: #fef2f2; border-left: 3px solid #450a0a; border-radius: 0 8px 8px 0;}
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #fca5a5; border: 3px solid #450a0a; border-radius: 8px; }
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
            left: 10 + Math.random() * 70, // 10% ~ 80%のランダムなX座標
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
                    // ホストから他の全員へ転送
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
                    setError('ホストがルームを解散しました。');
                    setCurrentRoomId(null);
                    setGameState(initialGameState);
                } else if (data.type === 'KICKED') {
                    isIntentionalClose = true;
                    setError('ルームから退出させられました。');
                    setCurrentRoomId(null);
                    setGameState(initialGameState);
                } else if (data.type === 'EMOTE') {
                    addEmoteToScreen(data.senderId, data.emoji);
                }
            });

            conn.on('close', () => {
                if (!isIntentionalClose) {
                    setError('ホストとの通信が切断されました。');
                    setCurrentRoomId(null);
                    setGameState(initialGameState);
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
        }, 100);
    };

    // モックデータの生成
    const getMockProducts = (rounds, gameMode) => {
        const fallbackProducts = [
            { name: "【送料無料】最高級黒毛和牛 焼肉セット 500g", price: 5980, description: "とろけるような食感の最高級黒毛和牛。お歳暮やギフトにぴったりです。厳選された部位を丁寧にカットしてお届けします。口の中でとろける旨味をご堪能ください。特別な日のお祝いにも最適です。", image: "https://placehold.co/400x400/ef4444/white?text=Wagyu+1", images: ["https://placehold.co/400x400/ef4444/white?text=Wagyu+1", "https://placehold.co/400x400/ef4444/white?text=Wagyu+2", "https://placehold.co/400x400/ef4444/white?text=Wagyu+3"], url: "https://www.rakuten.co.jp/", tags: ["肉のたじまや", "送料無料"], reviewCount: 1250, reviewAverage: 4.8 },
            { name: "【ノイズキャンセリング機能付き】ワイヤレスイヤホン", price: 12800, description: "最新のノイズキャンセリング機能を搭載した高音質イヤホン。長時間のバッテリー駆動と、クリアな通話品質。通勤や通学、テレワークなど様々なシーンで活躍します。耳にフィットする人間工学に基づいたデザインです。", image: "https://placehold.co/400x400/3b82f6/white?text=Earphone+1", images: ["https://placehold.co/400x400/3b82f6/white?text=Earphone+1", "https://placehold.co/400x400/3b82f6/white?text=Earphone+2", "https://placehold.co/400x400/3b82f6/white?text=Earphone+3"], url: "https://www.rakuten.co.jp/", tags: ["家電のさくら", "ノイズキャンセリング機能付き"], reviewCount: 840, reviewAverage: 4.5 },
            { name: "【ギフト最適】京都抹茶スイーツ詰め合わせ", price: 3240, description: "老舗茶屋が作る濃厚抹茶スイーツの贅沢セット。抹茶ロールケーキ、抹茶プリン、抹茶クッキーなど、様々な食感と味わいを楽しめます。大切な方への贈り物や、自分へのご褒美にいかがでしょうか。", image: "https://placehold.co/400x400/10b981/white?text=Matcha+1", images: ["https://placehold.co/400x400/10b981/white?text=Matcha+1", "https://placehold.co/400x400/10b981/white?text=Matcha+2", "https://placehold.co/400x400/10b981/white?text=Matcha+3"], url: "https://www.rakuten.co.jp/", tags: ["京都老舗茶屋", "ギフト最適"], reviewCount: 2310, reviewAverage: 4.9 }
        ];

        let items = [];
        for (let i = 0; i < rounds; i++) {
            let item = { ...fallbackProducts[i % fallbackProducts.length] };
            if (gameMode === 'celeb') {
                item.price = item.price * 15; // セレブ風に価格を高くする
            }
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

    // APIからの商品フェッチ
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
        return <div className="flex flex-col justify-center items-center h-screen bg-[#ef4444] font-pop text-white gap-4"><Loader2 className="w-16 h-16 animate-spin" /><p className="font-black text-2xl text-stroke">通信準備中...</p></div>;
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
                    ) : gameState.status === 'lobby' ? (
                        <LobbyScreen
                            gameState={gameState} isHost={isHost} roomId={currentRoomId} myPeerId={myPeerIdRef.current}
                            updateSetting={(k, v) => updateGameState(prev => ({ ...prev, settings: { ...prev.settings, [k]: v } }))}
                            startGame={handleStartGame}
                            isLoading={isLoading}
                            handleKickPlayer={handleKickPlayer}
                            handleLeaveRoom={handleLeaveRoom}
                            productFetchError={productFetchError}
                        />
                    ) : gameState.status === 'playing' ? (
                        <GameScreen gameState={gameState} myPeerId={myPeerIdRef.current} submitGuess={submitGuess} handleLeaveRoom={handleLeaveRoom} sendLiveGuess={sendLiveGuess} />
                    ) : gameState.status === 'roundEnd' ? (
                        <RoundEndScreen gameState={gameState} myPeerId={myPeerIdRef.current} handleLeaveRoom={handleLeaveRoom} />
                    ) : gameState.status === 'result' ? (
                        <ResultScreen gameState={gameState} handleLeaveRoom={handleLeaveRoom} />
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
                            <span className="text-5xl md:text-7xl drop-shadow-lg">{emote.emoji}</span>
                            <span className="text-xs font-black bg-black bg-opacity-60 text-white px-2 py-1 rounded-full mt-1 border border-white/20 whitespace-nowrap">
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
        <div className="flex flex-col items-center justify-center mt-12 space-y-8 animate-fadeIn pb-12">
            <div className="animate-float text-center">
                <h1 className="text-5xl md:text-7xl font-black text-white text-stroke flex items-center justify-center gap-2">
                    <ShoppingCart className="w-12 h-12 md:w-16 md:h-16" strokeWidth={3} />
                    楽天プライスゲッサー
                </h1>
                <p className="text-xl md:text-2xl font-black text-yellow-300 text-stroke mt-4 tracking-widest">商品の値段をピッタリ当てろ！</p>
            </div>

            <div className="panel w-full max-w-2xl overflow-hidden flex flex-col">
                {/* Tabs */}
                <div className="flex bg-red-100 border-b-4 border-[#450a0a]">
                    <button
                        className={`flex-1 py-4 text-xl font-black transition-colors ${tab === 'create' ? 'bg-white text-red-600' : 'text-red-900 hover:bg-red-200'} border-r-4 border-[#450a0a]`}
                        onClick={() => setTab('create')}>
                        部屋を作る
                    </button>
                    <button
                        className={`flex-1 py-4 text-xl font-black transition-colors ${tab === 'join' ? 'bg-white text-red-600' : 'text-red-900 hover:bg-red-200'}`}
                        onClick={() => setTab('join')}>
                        部屋に入る
                    </button>
                </div>

                <div className="p-8 flex flex-col md:flex-row gap-8 items-center bg-[#f8fafc]">
                    <div className="w-32 h-32 rounded-full bg-yellow-300 panel-border flex items-center justify-center animate-pulse-pop shadow-[0_6px_0_#450a0a] shrink-0">
                        <User className="w-16 h-16 text-[#450a0a]" />
                    </div>

                    <div className="flex-1 space-y-6 w-full">
                        {error && (
                            <div className="bg-red-100 panel-border text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 font-bold shadow-[0_4px_0_#450a0a]">
                                <AlertCircle className="w-6 h-6 shrink-0" /> {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-[#450a0a] font-black mb-2 text-lg">ニックネーム</label>
                            <input
                                type="text" maxLength={10} placeholder="名前を入力"
                                className="w-full panel-border rounded-xl px-4 py-3 text-xl font-black focus:outline-none focus:bg-yellow-50 transition-colors shadow-[inset_0_4px_0_rgba(0,0,0,0.05)]"
                                value={playerName} onChange={(e) => setPlayerName(e.target.value)}
                            />
                        </div>

                        {tab === 'join' && (
                            <div className="animate-fadeIn">
                                <label className="block text-[#450a0a] font-black mb-2 text-lg">ルームID</label>
                                <input
                                    type="text" maxLength={5} placeholder="英数字5文字"
                                    className="w-full panel-border rounded-xl px-4 py-3 text-xl font-black uppercase tracking-widest text-center focus:outline-none focus:bg-yellow-50 transition-colors shadow-[inset_0_4px_0_rgba(0,0,0,0.05)]"
                                    value={roomIdInput} onChange={(e) => setRoomIdInput(e.target.value)}
                                />
                            </div>
                        )}

                        <button
                            onClick={tab === 'create' ? handleCreateRoom : handleJoinRoom}
                            disabled={isLoading}
                            className="w-full bg-green-500 hover:bg-green-400 text-white font-black py-4 rounded-xl text-2xl btn-solid flex justify-center items-center gap-2 mt-4"
                        >
                            {isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : <><Play className="w-8 h-8 fill-current" /> {tab === 'create' ? '開始' : '参加'}</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* 遊び方セクション */}
            <div className="panel w-full max-w-2xl bg-[#f8fafc] p-6 md:p-8 mt-8">
                <h2 className="text-2xl font-black text-[#450a0a] mb-6 flex items-center gap-2 border-b-4 border-dashed border-[#450a0a] pb-4">
                    <Info className="w-8 h-8 text-blue-500" strokeWidth={3} /> このゲームの遊び方
                </h2>
                <div className="space-y-6">
                    <div className="flex gap-4 items-start bg-white p-4 rounded-2xl panel-border shadow-[0_4px_0_#450a0a]">
                        <div className="w-12 h-12 rounded-full bg-yellow-300 panel-border flex items-center justify-center font-black text-xl text-[#450a0a] shrink-0">1</div>
                        <div>
                            <h3 className="font-black text-lg text-[#450a0a]">部屋を作って集まる</h3>
                            <p className="text-gray-600 font-bold mt-1 text-sm leading-relaxed">代表者が「部屋を作る」からルームを作成し、表示されたIDを友達に共有しよう。他の人は「部屋に入る」からIDを入力して合流！</p>
                        </div>
                    </div>
                    <div className="flex gap-4 items-start bg-white p-4 rounded-2xl panel-border shadow-[0_4px_0_#450a0a]">
                        <div className="w-12 h-12 rounded-full bg-red-400 panel-border flex items-center justify-center font-black text-xl text-white shrink-0">2</div>
                        <div>
                            <h3 className="font-black text-lg text-[#450a0a]">商品の値段を予想する</h3>
                            <p className="text-gray-600 font-bold mt-1 text-sm leading-relaxed">ゲームが始まると楽天市場の実際の商品が表示されます。画像や説明文から推測して、ズバリいくらか金額を入力！</p>
                        </div>
                    </div>
                    <div className="flex gap-4 items-start bg-white p-4 rounded-2xl panel-border shadow-[0_4px_0_#450a0a]">
                        <div className="w-12 h-12 rounded-full bg-blue-400 panel-border flex items-center justify-center font-black text-xl text-white shrink-0">3</div>
                        <div>
                            <h3 className="font-black text-lg text-[#450a0a]">結果発表＆スコア獲得</h3>
                            <p className="text-gray-600 font-bold mt-1 text-sm leading-relaxed">実際の販売価格に一番近いほど高得点！指定したラウンド数を戦って、合計スコアが一番高い人が優勝です🏆</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* モード紹介セクション */}
            <div className="panel w-full max-w-2xl bg-orange-50 p-6 md:p-8 mt-8">
                <h2 className="text-2xl font-black text-[#450a0a] mb-6 flex items-center gap-2 border-b-4 border-dashed border-[#450a0a] pb-4">
                    <Trophy className="w-8 h-8 text-orange-500" strokeWidth={3} /> ゲームモードの紹介
                </h2>
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-2xl panel-border shadow-[0_4px_0_#450a0a]">
                        <h3 className="font-black text-lg text-green-600 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />通常モード</h3>
                        <p className="text-gray-600 font-bold mt-1 text-sm leading-relaxed">正解の金額に一番近い予想をした人が高得点をもらえるスタンダードなルール。</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl panel-border shadow-[0_4px_0_#450a0a]">
                        <h3 className="font-black text-lg text-red-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />ドボンモード</h3>
                        <p className="text-gray-600 font-bold mt-1 text-sm leading-relaxed">正解の金額を「1円でもオーバー」するとドボンとなり0ポイント！チキンレースを楽しもう。</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl panel-border shadow-[0_4px_0_#450a0a]">
                        <h3 className="font-black text-lg text-blue-600 flex items-center gap-2"><ArrowUpCircle className="w-5 h-5" />ハイ＆ローモード</h3>
                        <p className="text-gray-600 font-bold mt-1 text-sm leading-relaxed">表示された基準価格よりも「高い」か「安い」かの2択で答えるシンプルモード！</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl panel-border shadow-[0_4px_0_#450a0a]">
                        <h3 className="font-black text-lg text-yellow-500 flex items-center gap-2"><Crown className="w-5 h-5" />セレブモード</h3>
                        <p className="text-gray-600 font-bold mt-1 text-sm leading-relaxed">出題されるのが5万円以上の高額商品ばかりに！金銭感覚が狂うこと間違いなし。</p>
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
        <div className="flex flex-col items-center w-full mt-4 animate-fadeIn">
            {/* Header Info */}
            <div className="w-full flex flex-col md:flex-row justify-between items-center md:items-end mb-6 px-2 gap-4 animate-float">
                <h2 className="text-4xl md:text-5xl font-black text-white text-stroke flex items-center gap-3 tracking-widest">
                    <Settings className="w-10 h-10 md:w-12 md:h-12" /> LOBBY
                </h2>
                <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
                    <LeaveButton onLeave={handleLeaveRoom} />
                    <div className="bg-white panel-border px-6 py-2 rounded-2xl flex items-center gap-4 shadow-[0_4px_0_#450a0a]">
                        <span className="font-black text-2xl text-[#450a0a]">ID: <span className="tracking-widest">{roomId}</span></span>
                        <button
                            onClick={handleCopy}
                            className={`p-2 rounded-xl panel-border transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-yellow-300 hover:bg-yellow-400 text-[#450a0a]'}`}
                            title="ルームIDをコピー"
                        >
                            {copied ? <Check strokeWidth={3} /> : <Copy strokeWidth={3} />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="panel w-full bg-[#f8fafc] overflow-hidden flex flex-col md:flex-row md:h-[600px]">
                {/* Left: Players */}
                <div className="w-full md:w-1/3 flex flex-col border-b-4 md:border-b-0 md:border-r-4 border-[#450a0a] bg-white h-[350px] md:h-full">
                    <div className="bg-purple-600 text-white font-black p-4 text-center border-b-4 border-[#450a0a] text-lg text-stroke-sm">
                        プレイヤー {playersEntries.length} / 14
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f1f5f9] custom-scrollbar panel-inset">
                        {playersEntries.map(([id, p]) => (
                            <div key={id} className="bg-white rounded-2xl p-2 flex items-center gap-3 panel-border shadow-[0_4px_0_#450a0a]">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl panel-border ${id === myPeerId ? 'bg-red-500' : 'bg-purple-500'}`}>
                                    {p.name.charAt(0)}
                                </div>
                                <span className="font-black text-lg flex-1 truncate text-[#450a0a]">{p.name}</span>
                                {p.isHost && <Crown className="text-yellow-500 w-8 h-8 mr-2 fill-current" />}

                                {!p.isHost && isHost && (
                                    <button
                                        onClick={() => handleKickPlayer(id)}
                                        className="bg-red-100 hover:bg-red-200 text-red-600 p-2 rounded-xl panel-border mr-2 transition-transform hover:scale-110 active:scale-95"
                                        title="このプレイヤーを退出させる"
                                    >
                                        <X strokeWidth={3} size={20} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {emptySlots.map((_, i) => (
                            <div key={`empty-${i}`} className="bg-gray-100 rounded-2xl p-2 flex items-center gap-3 panel-border opacity-60">
                                <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center panel-border">
                                    <User className="w-6 h-6 text-gray-500" />
                                </div>
                                <span className="font-black text-lg text-gray-400 flex-1">空</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Settings */}
                <div className="w-full md:w-2/3 flex flex-col bg-white md:h-full">
                    <div className="bg-blue-600 text-white font-black p-4 text-center border-b-4 border-[#450a0a] text-lg text-stroke-sm">
                        ゲーム設定
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[#f8fafc] custom-scrollbar panel-inset">
                        <SettingRow icon={<Crown size={28} strokeWidth={3} className="text-yellow-500" />} title="ゲームモード" desc="遊び方のルールを選択">
                            <div className="flex flex-col gap-2">
                                <select disabled={!isHost} className="w-full panel-border rounded-xl px-4 py-3 font-black focus:outline-none bg-white text-[#450a0a]" value={gameState.settings.gameMode} onChange={(e) => updateSetting('gameMode', e.target.value)}>
                                    <option value="normal">通常モード</option>
                                    <option value="dobon">ドボンモード</option>
                                    <option value="highlow">ハイ＆ローモード</option>
                                    <option value="celeb">セレブモード</option>
                                </select>
                                <div className="text-xs md:text-sm font-bold text-gray-600 bg-yellow-50 p-2 rounded-lg border-2 border-yellow-200 leading-snug">
                                    {gameState.settings.gameMode === 'normal' && '💡 正解の金額に一番近い人が高得点！'}
                                    {gameState.settings.gameMode === 'dobon' && '💡 1円でもオーバーするとドボンで0点！'}
                                    {gameState.settings.gameMode === 'highlow' && '💡 基準価格より「高いか安いか」の2択！'}
                                    {gameState.settings.gameMode === 'celeb' && '💡 5万円以上の高級品ばかりが登場！'}
                                </div>
                            </div>
                        </SettingRow>

                        <SettingRow icon={<ShoppingCart size={28} strokeWidth={3} />} title="ジャンル" desc="出題される商品のカテゴリを選択">
                            <select disabled={!isHost} className="w-full panel-border rounded-xl px-4 py-3 font-black focus:outline-none bg-white text-[#450a0a]" value={gameState.settings.genreId} onChange={(e) => updateSetting('genreId', e.target.value)}>
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

                        <SettingRow icon={<LinkIcon size={28} strokeWidth={3} />} title="フリーワード" desc="好きなキーワードで絞り込み (オプション)">
                            <input type="text" disabled={!isHost} placeholder="例: キャンプ, 家電" className="w-full panel-border rounded-xl px-4 py-3 font-black focus:outline-none bg-white text-[#450a0a] placeholder-gray-400" value={gameState.settings.keyword || ''} onChange={(e) => updateSetting('keyword', e.target.value)} />
                        </SettingRow>

                        <SettingRow icon={<CheckCircle2 size={28} strokeWidth={3} />} title="ラウンド数" desc="遊ぶ回数を選択">
                            <div className="flex gap-2">
                                {[3, 4, 5].map(r => (
                                    <button key={r} disabled={!isHost} onClick={() => updateSetting('rounds', r)} className={`flex-1 py-3 rounded-xl panel-border font-black text-lg transition-colors ${gameState.settings.rounds === r ? 'bg-blue-500 text-white shadow-[inset_0_4px_0_rgba(0,0,0,0.2)]' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>{r}回</button>
                                ))}
                            </div>
                        </SettingRow>

                        <SettingRow icon={<Clock size={28} strokeWidth={3} />} title="制限時間" desc="1ラウンドの予想時間">
                            <div className="grid grid-cols-4 gap-2">
                                {[15, 30, 60, 0].map(t => (
                                    <button key={t} disabled={!isHost} onClick={() => updateSetting('timeLimit', t)} className={`py-3 rounded-xl panel-border font-black text-sm md:text-base transition-colors ${gameState.settings.timeLimit === t ? 'bg-blue-500 text-white shadow-[inset_0_4px_0_rgba(0,0,0,0.2)]' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>{t === 0 ? '無制限' : `${t}秒`}</button>
                                ))}
                            </div>
                        </SettingRow>

                        <SettingRow icon={<Star size={28} strokeWidth={3} className="fill-yellow-400" />} title="最終ラウンドスコア2倍" desc="最後の問題は獲得スコアが2倍！">
                            <div className="flex gap-2">
                                <button disabled={!isHost} onClick={() => updateSetting('doubleFinalRound', true)} className={`flex-1 py-3 rounded-xl panel-border font-black text-lg transition-colors ${gameState.settings.doubleFinalRound ? 'bg-yellow-400 text-red-700 shadow-[inset_0_4px_0_rgba(0,0,0,0.2)]' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>ON</button>
                                <button disabled={!isHost} onClick={() => updateSetting('doubleFinalRound', false)} className={`flex-1 py-3 rounded-xl panel-border font-black text-lg transition-colors ${!gameState.settings.doubleFinalRound ? 'bg-gray-400 text-white shadow-[inset_0_4px_0_rgba(0,0,0,0.2)]' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>OFF</button>
                            </div>
                        </SettingRow>

                        <SettingRow icon={<Users size={28} strokeWidth={3} className="text-blue-500" />} title="入力金額の共有" desc="他の人が入力している金額をリアルタイムで表示">
                            <div className="flex gap-2">
                                <button disabled={!isHost} onClick={() => updateSetting('showLiveGuess', true)} className={`flex-1 py-3 rounded-xl panel-border font-black text-lg transition-colors ${gameState.settings.showLiveGuess ? 'bg-blue-500 text-white shadow-[inset_0_4px_0_rgba(0,0,0,0.2)]' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>ON</button>
                                <button disabled={!isHost} onClick={() => updateSetting('showLiveGuess', false)} className={`flex-1 py-3 rounded-xl panel-border font-black text-lg transition-colors ${!gameState.settings.showLiveGuess ? 'bg-gray-400 text-white shadow-[inset_0_4px_0_rgba(0,0,0,0.2)]' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>OFF</button>
                            </div>
                        </SettingRow>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-gray-200 border-t-4 border-[#450a0a] flex items-center justify-end gap-4">
                        {!isHost && <div className="text-[#450a0a] font-black mr-auto flex items-center gap-2 animate-pulse-pop"><Loader2 className="animate-spin" /> ホストの開始を待機中...</div>}
                        {isHost && (
                            productFetchError ? (
                                <div className="flex flex-col md:flex-row gap-3 items-center w-full animate-fadeIn bg-red-100 p-3 rounded-xl panel-border border-red-400">
                                    <span className="text-red-700 font-black text-sm md:text-base flex items-center gap-1 shrink-0"><AlertTriangle className="w-5 h-5" /> 商品取得に失敗</span>
                                    <div className="flex gap-2 w-full md:ml-auto">
                                        <button onClick={() => startGame(false)} disabled={isLoading} className="flex-1 md:flex-none bg-blue-500 hover:bg-blue-400 text-white font-black py-2 px-4 rounded-xl btn-solid flex items-center justify-center gap-2 text-sm">
                                            {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <><RefreshCw className="w-4 h-4" />再試行</>}
                                        </button>
                                        <button onClick={() => startGame(true)} disabled={isLoading} className="flex-1 md:flex-none bg-gray-600 hover:bg-gray-500 text-white font-black py-2 px-4 rounded-xl btn-solid flex items-center justify-center gap-2 text-sm whitespace-nowrap">
                                            <Play className="w-4 h-4 fill-current" /> モックで開始
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => startGame(false)} disabled={isLoading || Object.keys(gameState.players).length < 1} className="w-full md:w-auto bg-green-500 text-white font-black text-2xl py-3 px-12 rounded-xl btn-solid flex items-center justify-center gap-2">
                                    {isLoading ? <Loader2 className="animate-spin w-8 h-8" /> : <><Play className="fill-current w-8 h-8" /> 開始</>}
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
        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-2xl panel-border shadow-[0_4px_0_#450a0a]">
            <div className="flex items-center gap-4 w-full md:w-1/2">
                <div className="bg-red-100 p-3 rounded-xl text-red-600 panel-border shrink-0">
                    {icon}
                </div>
                <div>
                    <div className="font-black text-lg text-[#450a0a]">{title}</div>
                    <div className="text-xs text-gray-500 font-bold">{desc}</div>
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-black/60 animate-fadeIn">
                    <div className="bg-yellow-400 border-8 border-red-600 rounded-3xl p-8 md:p-12 transform -rotate-6 animate-pulse-pop shadow-[0_15px_0_#991b1b]">
                        <h2 className="text-4xl md:text-6xl font-black text-red-600 text-center text-stroke-sm leading-tight">
                            最終ラウンド！<br />
                            <span className="text-6xl md:text-8xl text-white text-stroke block mt-4 transform rotate-3">
                                獲得スコア2倍!!
                            </span>
                        </h2>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="w-full flex flex-wrap justify-between items-center mb-6 px-2 gap-4 animate-float">
                <div className="bg-white panel-border text-[#450a0a] font-black text-xl px-6 py-2 rounded-full shadow-[0_4px_0_#450a0a] flex items-center">
                    ラウンド <span className="text-red-600 text-3xl mx-1">{gameState.currentRound + 1}</span> / {gameState.settings.rounds}
                    {gameState.settings.doubleFinalRound && isFinalRound && (
                        <span className="bg-yellow-400 text-red-700 text-sm md:text-base px-2 py-1 rounded-lg ml-3 border-2 border-red-700 animate-pulse-pop shrink-0">スコア2倍!!</span>
                    )}
                </div>
                <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
                    <LeaveButton onLeave={handleLeaveRoom} />
                    <div className={`panel-border font-black text-3xl flex items-center gap-2 bg-white px-6 py-2 rounded-full shadow-[0_4px_0_#450a0a] ${!isUnlimited && timeLeft <= 5 ? 'animate-pulse text-red-600' : 'text-[#450a0a]'}`}>
                        <Clock className="w-8 h-8" /> {isUnlimited ? '∞' : `${timeLeft}秒`}
                    </div>
                </div>
            </div>

            <div className="panel w-full bg-[#f8fafc] p-4 md:p-6 flex flex-col gap-6">
                {/* Image & Title Container */}
                <div className="flex flex-col md:flex-row gap-6 bg-white p-4 rounded-2xl panel-border shadow-[0_4px_0_#450a0a]">
                    {/* Images */}
                    <div className="w-full md:w-1/2 flex flex-col items-center gap-4">
                        <div className="w-full aspect-square bg-gray-100 rounded-2xl panel-border flex items-center justify-center overflow-hidden p-2 relative panel-inset">
                            <img src={displayImages[selectedImageIndex]} className="max-w-full max-h-full object-contain animate-fadeIn" />
                        </div>
                        {displayImages.length > 1 && (
                            <div className="flex gap-3 w-full justify-center">
                                {displayImages.map((img, i) => (
                                    <button key={i} onClick={() => setSelectedImageIndex(i)} className={`w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden panel-border transition-transform hover:-translate-y-1 ${selectedImageIndex === i ? 'border-red-500 shadow-[0_4px_0_#ef4444]' : 'bg-gray-100'}`}>
                                        <img src={img} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 justify-center">
                            {currentProduct.tags.map((tag, i) => (
                                <span key={i} className="bg-red-100 text-red-800 text-xs font-black px-2 py-1 rounded-md panel-border">{tag}</span>
                            ))}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="w-full md:w-1/2 flex flex-col gap-4">
                        <h3 className="text-xl md:text-2xl font-black leading-snug text-[#450a0a] bg-yellow-100 p-4 rounded-2xl panel-border">{currentProduct.name}</h3>
                        {currentProduct.reviewCount > 0 && (
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl panel-border w-max shadow-[0_4px_0_#450a0a]">
                                <Star className="w-6 h-6 fill-yellow-400 text-yellow-500" />
                                <span className="text-xl font-black text-[#450a0a]">{currentProduct.reviewAverage}</span>
                                <span className="text-gray-500 text-sm font-bold">({currentProduct.reviewCount.toLocaleString()})</span>
                            </div>
                        )}
                        <div className="flex-1 bg-gray-50 p-4 rounded-2xl panel-border overflow-y-auto custom-scrollbar text-sm font-bold text-gray-700 max-h-48 md:max-h-80 panel-inset whitespace-pre-wrap leading-relaxed">
                            {currentProduct.description}
                        </div>
                    </div>
                </div>

                {/* Input Area */}
                <div className="w-full bg-[#450a0a] p-4 md:p-6 rounded-3xl panel-border shadow-[0_8px_0_#270606] flex flex-col justify-center">
                    {me?.hasGuessed ? (
                        <div className="text-center py-4 text-white animate-pulse-pop">
                            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-2" />
                            <h3 className="text-3xl font-black text-stroke-sm">予想完了！</h3>
                            <p className="font-bold mt-2 text-red-200">
                                {Object.keys(gameState.players).length > 1 ? "他のプレイヤーを待っています..." : "まもなく正解発表です..."}
                            </p>
                        </div>
                    ) : isHighLow ? (
                        <div className="flex flex-col items-center gap-4 w-full">
                            <div className="text-xl md:text-2xl font-black text-white text-stroke-sm mb-2 text-center">
                                実際の価格は、基準価格 <span className="text-yellow-300 text-3xl md:text-4xl bg-black/30 px-3 py-1 rounded-xl">¥{currentProduct.basePrice.toLocaleString()}</span> より...
                            </div>
                            <div className="flex w-full gap-4 md:gap-8">
                                <button
                                    onClick={() => submitGuess('high')}
                                    disabled={me?.hasGuessed}
                                    className="flex-1 bg-red-500 hover:bg-red-400 text-white font-black py-4 md:py-6 rounded-2xl text-2xl md:text-3xl btn-solid disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <ArrowUpCircle size={32} /> 高い
                                </button>
                                <button
                                    onClick={() => submitGuess('low')}
                                    disabled={me?.hasGuessed}
                                    className="flex-1 bg-blue-500 hover:bg-blue-400 text-white font-black py-4 md:py-6 rounded-2xl text-2xl md:text-3xl btn-solid disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <ArrowDownCircle size={32} /> 安い
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={onSubmit} className="flex flex-col md:flex-row items-center gap-4 w-full">
                            <div className="flex items-center gap-3 flex-1 w-full bg-white rounded-2xl panel-border px-4 py-2 shadow-[inset_0_4px_0_rgba(0,0,0,0.1)]">
                                <span className="text-4xl font-black text-red-500">¥</span>
                                <input
                                    ref={inputRef}
                                    type="number" autoFocus placeholder="ズバリ、いくら？"
                                    min="0"
                                    className="flex-1 w-full bg-transparent text-3xl md:text-4xl font-black text-[#450a0a] focus:outline-none text-right py-2 placeholder-gray-300"
                                    value={guessInput}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || Number(val) >= 0) setGuessInput(val);
                                    }}
                                />
                            </div>
                            <button
                                type="submit" disabled={!guessInput}
                                className="w-full md:w-auto bg-green-500 hover:bg-green-400 text-white font-black py-4 px-12 rounded-2xl text-2xl btn-solid disabled:opacity-50 whitespace-nowrap"
                            >決定！</button>
                        </form>
                    )}
                </div>

                {/* Live Guess Area */}
                {gameState.settings.showLiveGuess && !isHighLow && (
                    <div className="w-full bg-white p-4 rounded-2xl panel-border shadow-[0_4px_0_#450a0a] mt-2 animate-fadeIn">
                        <h4 className="font-black text-[#450a0a] mb-3 flex items-center gap-2"><Users size={20} /> みんなの入力状況</h4>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(gameState.players).map(([id, p]) => (
                                <div key={id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 ${p.hasGuessed ? 'bg-green-100 border-green-500' : 'bg-gray-50 border-gray-300'} ${id === myPeerId ? 'border-red-400 bg-red-50 shadow-[inset_0_2px_0_rgba(0,0,0,0.1)]' : ''}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${id === myPeerId ? 'bg-red-500' : 'bg-purple-500'}`}>
                                        {p.name.charAt(0)}
                                    </div>
                                    <span className="font-bold text-sm text-gray-700">{p.name}</span>
                                    <span className={`font-black ml-2 ${p.hasGuessed ? 'text-green-600' : 'text-blue-600'}`}>
                                        {p.hasGuessed ? `¥${Number(p.currentGuess).toLocaleString()}!` : (p.liveGuess ? `¥${Number(p.liveGuess).toLocaleString()}?` : '考え中...')}
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
                    <div className="bg-yellow-400 text-red-700 font-black text-2xl md:text-4xl px-8 py-2 rounded-full border-4 border-red-700 mb-4 transform rotate-2 animate-pulse-pop shadow-[0_4px_0_#b91c1c]">
                        🔥 最終ラウンド 獲得スコア2倍!! 🔥
                    </div>
                )}
                <h2 className="text-5xl md:text-6xl font-black text-white text-stroke transform -rotate-2 tracking-widest">
                    正解発表！
                </h2>
            </div>

            <div className="panel w-full max-w-2xl bg-white p-8 flex flex-col items-center relative text-center pt-12 mt-4">
                <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-red-500 via-yellow-400 to-red-500"></div>

                {isHighLow && (
                    <div className="text-xl font-black text-gray-500 mb-2">基準価格: ¥{currentProduct.basePrice.toLocaleString()}</div>
                )}

                <img src={currentProduct.image} className="w-48 h-48 md:w-64 md:h-64 object-contain mb-6 panel-border rounded-2xl bg-gray-50 shadow-[0_4px_0_#450a0a] p-2" />
                <h3 className="text-xl md:text-2xl font-black mb-2 text-[#450a0a] leading-snug">{currentProduct.name}</h3>
                <p className="text-gray-500 font-bold mt-2">気になる正解は...</p>

                <div className="text-6xl md:text-7xl font-black text-red-600 my-6 text-stroke-sm bg-yellow-100 px-8 py-4 rounded-3xl panel-border shadow-[0_6px_0_#450a0a] animate-pulse-pop">
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
                        <div key={id} className={`flex items-center gap-4 bg-white rounded-2xl p-4 panel-border ${id === myPeerId ? 'shadow-[0_6px_0_#ef4444] border-red-500' : 'shadow-[0_6px_0_#450a0a]'}`}>
                            <div className="w-10 text-center font-black text-gray-400 text-2xl">{index + 1}</div>
                            <div className="flex-1">
                                <div className="font-black text-xl text-[#450a0a]">{p.name}</div>
                                <div className="text-sm text-gray-600 font-bold mt-1">
                                    予想: <span className={`text-lg ${p.isDobon ? 'text-gray-400 line-through' : 'text-red-600'}`}>{guessDisplay}</span>
                                    {diffDisplay && <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded">{diffDisplay}</span>}
                                    {p.isDobon && <span className="ml-2 text-xs bg-red-600 text-white px-2 py-1 rounded shadow-[0_2px_0_#7f1d1d] animate-pulse-pop inline-block">ドボン!!</span>}
                                    {isHighLow && p.hasGuessed && (
                                        <span className={`ml-2 text-xs px-2 py-1 rounded font-black text-white ${p.lastPoints > 0 ? 'bg-green-500' : 'bg-gray-400'}`}>
                                            {p.lastPoints > 0 ? '正解！' : '不正解...'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="font-black text-3xl text-green-500 text-stroke-sm">+{p.lastPoints}</div>
                                <div className="text-xs font-bold text-gray-400 mt-1 mb-1">獲得スコア</div>
                                <div className="text-sm font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md border-2 border-blue-200">累計: {p.score}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="mt-12 font-black text-white text-xl animate-pulse text-stroke">次のラウンドへ進みます...</p>
        </div>
    );
}

function ResultScreen({ gameState, handleLeaveRoom }) {
    const sortedPlayers = Object.entries(gameState.players).sort((a, b) => b[1].score - a[1].score);

    return (
        <div className="mt-8 flex flex-col items-center pb-24 animate-fadeIn">
            <div className="animate-float z-10 -mb-6">
                <h2 className="text-6xl font-black text-yellow-300 text-stroke mb-8 flex items-center gap-3 transform -rotate-2">
                    <Trophy className="w-16 h-16 fill-current" /> 最終結果
                </h2>
            </div>

            <div className="w-full max-w-3xl flex flex-col gap-4 mb-12 bg-white panel p-6 md:p-8 pt-12 mt-4">
                {sortedPlayers.map(([id, p], index) => (
                    <div key={id} className={`flex items-center gap-6 bg-white rounded-2xl p-4 md:p-6 panel-border ${index === 0 ? 'bg-yellow-50 shadow-[0_6px_0_#eab308] border-yellow-500 transform scale-[1.02] z-10 animate-pulse-pop' : 'shadow-[0_4px_0_#450a0a]'}`}>
                        <div className={`w-14 h-14 md:w-16 md:h-16 flex items-center justify-center rounded-full font-black text-3xl text-white panel-border ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>
                            {index + 1}
                        </div>
                        <div className="flex-1 text-2xl md:text-3xl font-black text-[#450a0a]">{p.name}</div>
                        <div className="text-right">
                            <div className="text-4xl md:text-5xl font-black text-red-500 text-stroke-sm">{p.score}</div>
                            <div className="text-sm font-bold text-gray-500">トータルスコア</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="w-full max-w-3xl panel bg-[#f8fafc] p-6 md:p-8">
                <h3 className="text-2xl font-black text-[#450a0a] mb-6 text-center border-b-4 border-[#450a0a] pb-4 border-dashed">登場した商品</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {gameState.products.map((prod, i) => (
                        <div key={i} className="bg-white rounded-2xl p-4 flex flex-col gap-3 panel-border shadow-[0_4px_0_#450a0a] transition-transform hover:-translate-y-1">
                            <div className="flex gap-4">
                                <img src={prod.image} className="w-24 h-24 object-contain rounded-xl panel-border p-1 bg-gray-50 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-black text-sm line-clamp-2 leading-tight text-[#450a0a]">{prod.name}</h4>
                                    {prod.reviewCount > 0 && (
                                        <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold mt-1">
                                            <Star className="w-4 h-4 fill-current" />
                                            <span>{prod.reviewAverage}</span>
                                            <span className="text-gray-400 font-normal">({prod.reviewCount.toLocaleString()})</span>
                                        </div>
                                    )}
                                    <p className="text-red-600 font-black mt-1 text-lg">¥{prod.price.toLocaleString()}</p>
                                </div>
                            </div>
                            <a
                                href={prod.url} target="_blank" rel="noopener noreferrer"
                                className="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 font-black py-3 rounded-xl flex justify-center items-center gap-2 panel-border btn-solid mt-2"
                            >
                                <LinkIcon strokeWidth={3} /> 楽天市場で見る
                            </a>
                        </div>
                    ))}
                </div>
            </div>

            <button
                onClick={handleLeaveRoom}
                className="mt-12 bg-[#450a0a] hover:bg-[#270606] text-white font-black py-4 px-16 rounded-2xl text-2xl btn-solid shadow-[0_6px_0_#000]"
            >
                タイトルへ戻る
            </button>
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
                className="bg-red-600 hover:bg-red-700 text-white font-black px-4 py-2 rounded-xl panel-border shadow-[0_4px_0_#450a0a] flex items-center gap-2 animate-pulse-pop shrink-0"
            >
                <LogOut size={20} strokeWidth={3} /> 退出する！
            </button>
        );
    }

    return (
        <button
            onClick={() => setConfirming(true)}
            className="bg-gray-200 hover:bg-gray-300 text-[#450a0a] font-black px-4 py-2 rounded-xl panel-border shadow-[0_4px_0_#450a0a] flex items-center gap-2 transition-colors shrink-0"
        >
            <LogOut size={20} strokeWidth={3} /> 退出
        </button>
    );
}

function EmoteMenu({ onEmote }) {
    const [isOpen, setIsOpen] = useState(false);
    const emojis = ['😲', '💸', '🤑', '😭', '👏', '🤔'];

    return (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3">
            {isOpen && (
                <div className="flex flex-col gap-2 bg-white/90 p-2 rounded-full panel-border shadow-[0_4px_0_#450a0a] animate-fadeIn backdrop-blur-sm">
                    {emojis.map(e => (
                        <button key={e} onClick={() => { onEmote(e); setIsOpen(false); }} className="text-3xl w-12 h-12 flex items-center justify-center hover:scale-125 transition-transform hover:bg-gray-100 rounded-full">
                            {e}
                        </button>
                    ))}
                </div>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-16 h-16 rounded-full flex items-center justify-center panel-border shadow-[0_4px_0_#450a0a] transition-all hover:scale-105 ${isOpen ? 'bg-gray-200 text-[#450a0a]' : 'bg-yellow-400 text-white'}`}
            >
                {isOpen ? <X size={32} strokeWidth={3} /> : <MessageCircle size={32} fill="currentColor" strokeWidth={2} className="text-[#450a0a]" />}
            </button>
        </div>
    );
}