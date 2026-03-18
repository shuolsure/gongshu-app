"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Zap, User, PlusSquare, ThumbsUp, ThumbsDown, ChevronRight, ChevronLeft, ArrowLeft, Share2, MoreHorizontal, Clock, TrendingUp } from "lucide-react";

// Types
interface User {
  id: string;
  secondmeUserId: string;
  name: string | null;
  avatar: string | null;
  novelCount: number;
  voteCount: number;
}

interface Novel {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  chapterCount: number;
  totalVotes: number;
  contributorCount: number;
  coverImage: string | null;
  lastUpdateAt: string;
  authorId: string;
  author: { name: string | null; secondmeUserId: string };
  chapters: { id: string; chapterNumber: number; title: string; content: string; author: string; votes: number }[];
  userVote: string | null;
  hotScore?: number;
}

interface Continuation {
  id: string;
  author: string;
  authorId: string;
  content: string;
  wordCount: number;
  votes: number;
  likes: number;
  dislikes: number;
  createdAt: string;
  userVote: string | null;
}

// 底部导航
function BottomNav({ activeTab, setTab }: { activeTab: string; setTab: (t: string) => void }) {
  const items = [
    { id: "new", label: "新书", icon: Zap },
    { id: "serial", label: "连载", icon: BookOpen },
    { id: "my", label: "我的", icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 h-16 flex items-center justify-around z-50">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setTab(item.id)}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === item.id ? "text-[#0066ff]" : "text-zinc-400"}`}
        >
          <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// 作品卡片
function NovelCard({ 
  novel, 
  onClick,
  onVote 
}: { 
  novel: Novel; 
  onClick: () => void;
  onVote: (voteType: 'like' | 'dislike') => void;
}) {
  const handleVote = (e: React.MouseEvent, voteType: 'like' | 'dislike') => {
    e.stopPropagation(); // 阻止冒泡，避免打开详情页
    onVote(voteType);
  };

  return (
    <div onClick={onClick} className="flex gap-4 p-2 active:bg-zinc-50 rounded-xl transition-colors cursor-pointer">
      <div className="w-24 h-32 bg-zinc-100 rounded-lg shadow-sm flex-shrink-0 relative overflow-hidden border border-zinc-200">
        {novel.coverImage ? (
          <img src={novel.coverImage} alt={novel.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-[8px] font-bold text-zinc-400 uppercase mb-1 line-clamp-1">{novel.author.name || novel.author.secondmeUserId}</span>
            <span className="text-[10px] font-bold text-zinc-800 leading-tight line-clamp-3">{novel.title}</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#0066ff]" />
      </div>
      <div className="flex-1 py-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-zinc-900 mb-1">{novel.title}</h3>
          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mb-2">{novel.summary}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#0066ff] bg-blue-50 px-3 py-1 rounded-full">第 {novel.chapterCount} 章</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border border-zinc-100 rounded px-2 py-0.5">
              <button 
                onClick={(e) => handleVote(e, 'like')}
                className={`flex items-center gap-1 ${novel.userVote === 'like' ? 'text-[#0066ff]' : 'text-zinc-400 hover:text-[#0066ff]'}`}
              >
                <ThumbsUp size={12} />
                <span className="text-[10px] font-bold">{novel.totalVotes}</span>
              </button>
              <div className="w-[1px] h-3 bg-zinc-100" />
              <button 
                onClick={(e) => handleVote(e, 'dislike')}
                className={`${novel.userVote === 'dislike' ? 'text-red-500' : 'text-zinc-300 hover:text-red-500'} transition-colors`}
              >
                <ThumbsDown size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 并列续写滑块
function ContinuationSlider({ 
  continuations, 
  onVote 
}: { 
  continuations: Continuation[];
  onVote: (continuationId: string, voteType: 'like' | 'dislike') => void;
}) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [localContinuations, setLocalContinuations] = useState(continuations);

  // 同步外部数据
  useEffect(() => {
    setLocalContinuations(continuations);
  }, [continuations]);

  const next = () => { setIndex((i) => (i + 1) % localContinuations.length); setExpanded(false); };
  const prev = () => { setIndex((i) => (i - 1 + localContinuations.length) % localContinuations.length); setExpanded(false); };

  const handleVote = (voteType: 'like' | 'dislike') => {
    const current = localContinuations[index];
    onVote(current.id, voteType);
    
    // 乐观更新
    setLocalContinuations(prev => prev.map(c => {
      if (c.id !== current.id) return c;
      
      const prevVote = c.userVote;
      let newLikes = c.likes;
      let newDislikes = c.dislikes;
      let newVotes = c.votes;
      
      if (prevVote === voteType) {
        // 取消投票
        if (voteType === 'like') { newLikes--; newVotes--; }
        else { newDislikes--; newVotes++; }
        return { ...c, likes: newLikes, dislikes: newDislikes, votes: newVotes, userVote: null };
      } else {
        // 新投票或切换投票
        if (prevVote === 'like') { newLikes--; newVotes--; }
        if (prevVote === 'dislike') { newDislikes--; newVotes++; }
        if (voteType === 'like') { newLikes++; newVotes++; }
        else { newDislikes++; newVotes--; }
        return { ...c, likes: newLikes, dislikes: newDislikes, votes: newVotes, userVote: voteType };
      }
    }));
  };

  if (localContinuations.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400">
        <p className="text-sm">暂无并列续写</p>
        <p className="text-xs mt-1">成为第一个续写者吧！</p>
      </div>
    );
  }

  const current = localContinuations[index];

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-[#0066ff] rounded-full" />
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-widest">并列续写</span>
        </div>
        <span className="text-[10px] text-zinc-400 font-mono">{index + 1} / {localContinuations.length}</span>
      </div>

      <div className="flex items-center gap-2">
        {!expanded && (
          <button onClick={prev} className="p-1 text-zinc-200 hover:text-[#0066ff]">
            <ChevronLeft size={28} />
          </button>
        )}

        <motion.div
          layout
          className={`flex-1 transition-all duration-500 ${expanded ? "p-0 bg-transparent" : "p-6 bg-white border border-zinc-100 rounded-3xl shadow-xl shadow-zinc-200/40"}`}
        >
          <p className={`text-base text-zinc-700 leading-relaxed font-serif ${expanded ? "text-lg text-zinc-800" : "line-clamp-3"}`}>
            {current.content}
          </p>
          <button onClick={() => setExpanded(!expanded)} className="mx-auto mt-6 flex flex-col items-center gap-1 text-zinc-300 hover:text-[#0066ff]">
            <span className="text-[8px] font-bold uppercase tracking-tighter">{expanded ? "收起" : "展开"}</span>
            {expanded ? <ChevronRight size={20} className="rotate-90" /> : <ChevronRight size={20} className="-rotate-90" />}
          </button>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-50 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-400">{current.author[0]}</div>
              <span className="text-xs font-medium text-zinc-500">{current.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleVote('like')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  current.userVote === 'like' 
                    ? "bg-[#0066ff] text-white" 
                    : "bg-zinc-50 text-zinc-500 hover:text-[#0066ff] hover:bg-blue-50"
                }`}
              >
                <ThumbsUp size={14} />
                <span>{current.votes}</span>
              </button>
              <button 
                onClick={() => handleVote('dislike')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  current.userVote === 'dislike' 
                    ? "bg-red-500 text-white" 
                    : "bg-zinc-50 text-zinc-500 hover:text-red-500 hover:bg-red-50"
                }`}
              >
                <ThumbsDown size={14} />
              </button>
            </div>
          </div>
        </motion.div>

        {!expanded && (
          <button onClick={next} className="p-1 text-zinc-200 hover:text-[#0066ff]">
            <ChevronRight size={28} />
          </button>
        )}
      </div>
    </div>
  );
}

// 阅读器
function NovelReader({ 
  novel, 
  onBack,
  onOpenContinuationEditor 
}: { 
  novel: Novel; 
  onBack: () => void;
  onOpenContinuationEditor: () => void;
}) {
  const [continuations, setContinuations] = useState<Continuation[]>([]);
  const [loadingContinuations, setLoadingContinuations] = useState(true);

  const fetchContinuations = async () => {
    setLoadingContinuations(true);
    try {
      const res = await fetch(`/api/novels/${novel.id}/continuations`);
      const data = await res.json();
      if (data.code === 0) {
        setContinuations(data.data.continuations);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingContinuations(false);
  };

  useEffect(() => {
    fetchContinuations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novel.id]);

  const handleContinuationVote = async (continuationId: string, voteType: 'like' | 'dislike') => {
    try {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'continuation',
          targetId: continuationId,
          voteType,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      className="fixed inset-0 z-50 bg-[#fdfdfd] overflow-y-auto"
    >
      <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-100 h-14 flex items-center px-4 z-10">
        <ArrowLeft size={20} onClick={onBack} className="text-zinc-900 mr-4 cursor-pointer" />
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-zinc-900 truncate text-sm">{novel.title}</h2>
          <p className="text-[10px] text-zinc-400 font-mono uppercase">阅读模式</p>
        </div>
        <div className="flex items-center gap-4 text-zinc-400">
          <Share2 size={18} />
          <MoreHorizontal size={18} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-center mb-16">
          <h1 className="text-3xl font-bold text-zinc-900 mb-4 leading-tight">{novel.title}</h1>
          <div className="flex items-center justify-center gap-2 text-zinc-400 text-xs">
            <span>{novel.author.name || novel.author.secondmeUserId}</span>
            <span>·</span>
            <span>{novel.chapterCount} 章</span>
          </div>
        </div>

        <div className="space-y-20">
          {novel.chapters?.map((chapter) => (
            <section key={chapter.id} className="relative">
              <div className="flex items-center gap-3 mb-8">
                <div className="h-[1px] flex-1 bg-zinc-100" />
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-[0.2em]">{chapter.title}</h3>
                <div className="h-[1px] flex-1 bg-zinc-100" />
              </div>
              <p className="text-zinc-800 text-lg leading-[1.8] font-serif mb-8 text-justify">{chapter.content}</p>
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono italic mb-8">
                <span>作者: {chapter.author}</span>
                <div className="flex items-center gap-4 not-italic">
                  <button className="flex items-center gap-1 text-zinc-400 hover:text-[#0066ff]">
                    <ThumbsUp size={12} /> <span>赞</span>
                  </button>
                  <button className="flex items-center gap-1 text-zinc-400 hover:text-red-500">
                    <ThumbsDown size={12} /> <span>踩</span>
                  </button>
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* 并列续写滑块 */}
        {loadingContinuations ? (
          <div className="mt-16 text-center text-zinc-400 text-sm">加载续写中...</div>
        ) : continuations.length > 0 ? (
          <div className="mt-16">
            <ContinuationSlider continuations={continuations} onVote={handleContinuationVote} />
          </div>
        ) : null}

        {/* 故事边缘 */}
        <div className="mt-24 pt-12 border-t border-zinc-100 text-center pb-32">
          <div className="inline-block w-8 h-1 bg-zinc-200 rounded-full mb-6" />
          <h3 className="text-xl font-bold text-zinc-900 mb-2">故事正在发展...</h3>
          <p className="text-sm text-zinc-500 mb-8">这是故事的当前边缘</p>
          <button 
            onClick={onOpenContinuationEditor}
            className="w-full max-w-sm bg-[#0066ff] text-white h-12 rounded-full font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            我来续写
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// 编辑器
function Editor({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: { title: string; summary: string; content: string; coverImage: string }) => void }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");

  const handleSubmit = () => {
    if (content.length < 1000) {
      alert("正文内容至少需要1000字");
      return;
    }
    onSubmit({ title, summary, content, coverImage });
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      className="fixed inset-0 z-[100] bg-white flex flex-col"
    >
      <div className="h-14 border-b border-zinc-100 flex items-center justify-between px-4">
        <button onClick={onClose} className="text-zinc-500 font-medium">取消</button>
        <h2 className="font-bold text-zinc-900">新故事</h2>
        <button onClick={handleSubmit} className="text-[#0066ff] font-bold">发布</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <input
          type="text"
          placeholder="小说名"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-3xl font-bold focus:outline-none placeholder:text-zinc-200"
        />

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">简介</label>
          <textarea
            rows={3}
            placeholder="输入小说简介，吸引更多读者..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full text-sm text-zinc-600 focus:outline-none resize-none border-b border-zinc-50 pb-4"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">封面图片 URL</label>
          <input
            type="text"
            placeholder="https://example.com/cover.jpg"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            className="w-full text-xs text-zinc-500 focus:outline-none border-b border-zinc-50 pb-4"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">正文内容</label>
            <span className={`text-[10px] italic px-2 py-0.5 rounded ${content.length >= 1000 ? "bg-green-50 text-green-600" : "bg-zinc-50 text-zinc-400"}`}>
              {content.length} 字 {content.length >= 1000 ? "✓" : "(至少1000字)"}
            </span>
          </div>
          <textarea
            rows={20}
            placeholder="开始你的创作，构建一个宏大的世界..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full text-base text-zinc-800 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        <div className="pt-8 pb-12">
          <button onClick={handleSubmit} className="w-full bg-[#0066ff] text-white h-14 rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-[0.98] transition-all">
            发布小说
          </button>
          <p className="text-center text-[10px] text-zinc-400 mt-4">发布即表示同意《创作协议》</p>
        </div>
      </div>
    </motion.div>
  );
}

// 续写编辑器
function ContinuationEditor({ 
  novelTitle, 
  onClose, 
  onSubmit 
}: { 
  novelId: string; 
  novelTitle: string;
  onClose: () => void; 
  onSubmit: (content: string) => void 
}) {
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (content.length < 1000) {
      alert("正文内容至少需要1000字");
      return;
    }
    onSubmit(content);
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      className="fixed inset-0 z-[100] bg-white flex flex-col"
    >
      <div className="h-14 border-b border-zinc-100 flex items-center justify-between px-4">
        <button onClick={onClose} className="text-zinc-500 font-medium">取消</button>
        <h2 className="font-bold text-zinc-900 text-sm truncate max-w-[60%]">续写：{novelTitle}</h2>
        <button onClick={handleSubmit} className="text-[#0066ff] font-bold">提交</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">续写内容</label>
            <span className={`text-[10px] italic px-2 py-0.5 rounded ${content.length >= 1000 ? "bg-green-50 text-green-600" : "bg-zinc-50 text-zinc-400"}`}>
              {content.length} 字 {content.length >= 1000 ? "✓" : "(至少1000字)"}
            </span>
          </div>
          <textarea
            rows={25}
            placeholder="续写故事，让剧情在这里分叉..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full text-base text-zinc-800 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        <div className="pt-8 pb-12">
          <button onClick={handleSubmit} className="w-full bg-[#0066ff] text-white h-14 rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-[0.98] transition-all">
            提交续写
          </button>
          <p className="text-center text-[10px] text-zinc-400 mt-4">同一章节只能保留最后一个续写</p>
        </div>
      </div>
    </motion.div>
  );
}

// 主页面
export default function Home() {
  const [tab, setTab] = useState("new");
  const [user, setUser] = useState<User | null>(null);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showContinuationEditor, setShowContinuationEditor] = useState(false);
  const [sortBy, setSortBy] = useState<"hot" | "time">("hot");
  const [loading, setLoading] = useState(true);
  const [myTab, setMyTab] = useState<"liked" | "coauthored">("liked");
  const [likedNovels, setLikedNovels] = useState<Novel[]>([]);
  const [coauthoredNovels, setCoauthoredNovels] = useState<Novel[]>([]);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/user/info");
      const data = await res.json();
      if (data.code === 0) setUser(data.data);
    } catch {
      // Not logged in
    }
  };

  const fetchNovels = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/novels?sortBy=${sortBy}`);
      const data = await res.json();
      if (data.code === 0) setNovels(data.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchMyNovels = async () => {
    try {
      const res = await fetch(`/api/user/novels?type=${myTab}`);
      const data = await res.json();
      if (data.code === 0) {
        if (myTab === "liked") {
          setLikedNovels(data.data);
        } else {
          setCoauthoredNovels(data.data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchNovels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 排序变化时重新获取
  useEffect(() => {
    if (!loading) fetchNovels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  // 当用户切换到"我的"tab时获取喜欢/共书列表
  useEffect(() => {
    if (tab === "my" && user) {
      fetchMyNovels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user, myTab]);

  const handleCreateNovel = async (data: { title: string; summary: string; content: string; coverImage: string }) => {
    try {
      const res = await fetch("/api/novels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.code === 0) {
        setShowEditor(false);
        fetchNovels();
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error(err);
      alert("发布失败");
    }
  };

  const handleCreateContinuation = async (content: string) => {
    if (!selectedNovel) return;
    
    try {
      const res = await fetch(`/api/novels/${selectedNovel.id}/continuations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = await res.json();
      if (result.code === 0) {
        setShowContinuationEditor(false);
        // 重新选中小说以刷新续写列表
        setSelectedNovel({ ...selectedNovel });
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error(err);
      alert("续写提交失败");
    }
  };

  const handleNovelVote = async (novelId: string, voteType: 'like' | 'dislike') => {
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'novel',
          targetId: novelId,
          voteType,
        }),
      });
      const result = await res.json();
      if (result.code === 0) {
        fetchNovels();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredNovels = novels.filter((n) => {
    if (tab === "new") return n.status === "new";
    if (tab === "serial") return n.status === "serial";
    return true;
  });

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white relative">
      {/* 顶部栏 */}
      <div className="sticky top-0 z-40 bg-white border-b border-zinc-100 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-[#0066ff] rounded-full" />
          <h1 className="font-bold text-lg tracking-tight">共书</h1>
        </div>
        {tab !== "my" && (
          <button
            onClick={() => setSortBy(sortBy === "time" ? "hot" : "time")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-50 border border-zinc-100 text-zinc-500 hover:text-[#0066ff] transition-all"
          >
            {sortBy === "time" ? <Clock size={14} /> : <TrendingUp size={14} />}
            <span className="text-[10px] font-bold">{sortBy === "time" ? "时间" : "热度"}</span>
          </button>
        )}
      </div>

      {/* 内容区 */}
      <main className="min-h-screen pb-20">
        <AnimatePresence mode="wait">
          {tab === "new" && (
            <motion.div key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
              <div className="mb-6 px-2">
                <h2 className="text-2xl font-bold text-zinc-900 mb-1">新灵感</h2>
                <p className="text-xs text-zinc-400">期待与你共创3章</p>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {filteredNovels.map((novel) => (
                  <NovelCard 
                    key={novel.id} 
                    novel={novel} 
                    onClick={() => setSelectedNovel(novel)}
                    onVote={(voteType) => handleNovelVote(novel.id, voteType)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {tab === "serial" && (
            <motion.div key="serial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
              <div className="mb-6 px-2">
                <h2 className="text-2xl font-bold text-zinc-900 mb-1">共创区</h2>
                <p className="text-xs text-zinc-400">期待与你一起共创</p>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {filteredNovels.map((novel) => (
                  <NovelCard 
                    key={novel.id} 
                    novel={novel} 
                    onClick={() => setSelectedNovel(novel)}
                    onVote={(voteType) => handleNovelVote(novel.id, voteType)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {tab === "my" && (
            <motion.div key="my" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
              {user ? (
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-bold text-zinc-400">
                      {user.name?.[0] || user.secondmeUserId[0]}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-zinc-900">{user.name || user.secondmeUserId}</h2>
                      <p className="text-xs text-zinc-400">已连接 Second Me</p>
                    </div>
                  </div>
                  <div className="flex gap-12 mb-6">
                    <div><div className="text-lg font-bold text-zinc-900">{user.novelCount}</div><div className="text-[10px] text-zinc-400 uppercase">作品</div></div>
                    <div><div className="text-lg font-bold text-zinc-900">{user.voteCount}</div><div className="text-[10px] text-zinc-400 uppercase">投票</div></div>
                  </div>

                  {/* 喜欢/共书切换 */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setMyTab("liked")}
                      className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
                        myTab === "liked" 
                          ? "bg-[#0066ff] text-white" 
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      喜欢
                    </button>
                    <button
                      onClick={() => setMyTab("coauthored")}
                      className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
                        myTab === "coauthored" 
                          ? "bg-[#0066ff] text-white" 
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      共书
                    </button>
                  </div>

                  {/* 作品列表 */}
                  <div className="mt-4">
                    {myTab === "liked" && (
                      likedNovels.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {likedNovels.map((novel) => (
                            <NovelCard 
                              key={novel.id} 
                              novel={novel} 
                              onClick={() => setSelectedNovel(novel)}
                              onVote={(voteType) => handleNovelVote(novel.id, voteType)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-zinc-400 text-sm py-8">暂无喜欢的作品</p>
                      )
                    )}
                    {myTab === "coauthored" && (
                      coauthoredNovels.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {coauthoredNovels.map((novel) => (
                            <NovelCard 
                              key={novel.id} 
                              novel={novel} 
                              onClick={() => setSelectedNovel(novel)}
                              onVote={(voteType) => handleNovelVote(novel.id, voteType)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-zinc-400 text-sm py-8">暂无参与的作品</p>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-zinc-500 mb-4">登录后查看个人中心</p>
                  <a href="/api/auth/login" className="inline-block bg-[#0066ff] text-white px-6 py-3 rounded-full font-bold">登录 Second Me</a>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 悬浮按钮 */}
      {tab !== "my" && (
        <button onClick={() => setShowEditor(true)} className="fixed bottom-20 right-4 w-12 h-12 bg-[#0066ff] text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40">
          <PlusSquare size={24} />
        </button>
      )}

      <BottomNav activeTab={tab} setTab={setTab} />

      {/* 阅读器 */}
      <AnimatePresence>
        {selectedNovel && (
          <NovelReader 
            novel={selectedNovel} 
            onBack={() => setSelectedNovel(null)}
            onOpenContinuationEditor={() => setShowContinuationEditor(true)}
          />
        )}
      </AnimatePresence>

      {/* 新故事编辑器 */}
      <AnimatePresence>
        {showEditor && <Editor onClose={() => setShowEditor(false)} onSubmit={handleCreateNovel} />}
      </AnimatePresence>

      {/* 续写编辑器 */}
      <AnimatePresence>
        {showContinuationEditor && selectedNovel && (
          <ContinuationEditor
            novelId={selectedNovel.id}
            novelTitle={selectedNovel.title}
            onClose={() => setShowContinuationEditor(false)}
            onSubmit={handleCreateContinuation}
          />
        )}
      </AnimatePresence>
    </div>
  );
}