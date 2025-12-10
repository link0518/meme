import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Button } from './components/Button';
import { generateStickerPackOpenAI } from './services/geminiService';
import { sliceAndZipImage, downloadSingleImage } from './services/imageService';
import { StickerGenerationState } from './types';

const App: React.FC = () => {
  // --- Auth State ---
  // Client-side auth removed. Password is sent to backend for verification.
  const [passwordInput, setPasswordInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // --- App Logic State ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Crop Config
  const [cropRows, setCropRows] = useState(4);
  const [cropCols, setCropCols] = useState(6);

  // Generation Mode
  const [generationMode, setGenerationMode] = useState<'sticker-pack' | 'christmas-hat'>('sticker-pack');

  const [state, setState] = useState<StickerGenerationState>({
    isLoading: false,
    error: null,
    generatedImage: null,
  });

  // --- Auth Effects & Handlers ---
  useEffect(() => {
    const isAuth = sessionStorage.getItem('is_authenticated');
    const storedPassword = sessionStorage.getItem('access_password');
    if (isAuth === 'true' && storedPassword) {
      setIsAuthenticated(true);
      setPasswordInput(storedPassword);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple client-side gate. Real validation happens at API call.
    if (passwordInput.trim()) {
      setIsAuthenticated(true);
      sessionStorage.setItem('is_authenticated', 'true');
      sessionStorage.setItem('access_password', passwordInput);
    }
  };

  // --- App Handlers ---

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      setState(prev => ({ ...prev, generatedImage: null, error: null }));
    }
  };

  const handleGenerate = async () => {
    if (!selectedFile) return;

    // Custom Provider Validation
    // API Key and URL are now handled by backend
    /* 
    if (!customApiKey) { ... }
    if (!customBaseUrl) { ... }
    if (!customModel) { ... }
    */

    setState({ isLoading: true, error: null, generatedImage: null });

    try {
      const resultImage = await generateStickerPackOpenAI(selectedFile, {
        password: passwordInput,
        mode: generationMode
      });

      setState({ isLoading: false, error: null, generatedImage: resultImage });
    } catch (err: any) {
      setState({
        isLoading: false,
        error: err.message || "生成失败，请检查设置或重试。",
        generatedImage: null
      });
    }
  };

  const handleDownloadSingle = async () => {
    if (!state.generatedImage) return;
    const filename = `fox-sticker-sheet-${Date.now()}.png`;
    try {
      await downloadSingleImage(state.generatedImage, filename);
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmCropDownload = async () => {
    if (!state.generatedImage) return;

    setIsZipping(true);
    // Clear any previous errors
    setState(prev => ({ ...prev, error: null }));

    try {
      const blob = await sliceAndZipImage(state.generatedImage, cropRows, cropCols);
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `fox-stickers-pack-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("Zip failed:", e);
      setState(prev => ({ ...prev, error: `打包失败: ${e.message}` }));
    } finally {
      setIsZipping(false);
    }
  };

  const handleBackToHome = () => {
    setState(prev => ({ ...prev, generatedImage: null, error: null }));
    // Optional: Keep the selected file or clear it. Keeping it allows easy re-generation.
  };

  // --- Render Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-500 mb-2">
              毛毛狐表情包助手
            </h1>
            <p className="text-slate-400 text-sm">请输入访问密码</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Password"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-yellow-500 transition-colors text-center tracking-widest"
                autoFocus
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck="false"
              />
            </div>
            {/* Client-side error removed */}
            <Button type="submit" fullWidth>
              进入系统
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // --- Render Main App ---
  return (
    <div className="min-h-screen bg-slate-900 selection:bg-yellow-500/30">
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 pb-12 transition-all duration-300 ${state.generatedImage ? 'max-w-6xl' : 'max-w-4xl'}`}>
        <Header />

        {!state.generatedImage ? (
          /* ================= INPUT VIEW ================= */
          <>
            <div className="flex justify-end mb-4">
              {/* Settings button hidden as config is server-side */}
            </div>

            {/* Settings Panel - Removed as config is now server-side */}
            {/* 
            {showSettings && (
                 <div className="mb-8 p-6 bg-slate-800/80 border border-slate-700 rounded-xl backdrop-blur-sm shadow-lg">
                    <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                        API 配置
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">API Endpoint URL</label>
                            <input 
                                type="text" 
                                value={customBaseUrl}
                                onChange={(e) => setCustomBaseUrl(e.target.value)}
                                placeholder="e.g. https://your-worker.workers.dev"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-yellow-500 text-sm font-mono"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">无需包含 /v1/chat/completions，系统会自动补全。</p>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Model Name</label>
                            <input 
                                type="text" 
                                value={customModel}
                                onChange={(e) => setCustomModel(e.target.value)}
                                placeholder="e.g. gemini-2.0-flash-exp"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-yellow-500 text-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">
                                API Key
                            </label>
                            <input 
                                type="password" 
                                value={customApiKey}
                                onChange={(e) => setCustomApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-yellow-500 text-sm font-mono"
                            />
                        </div>
                    </div>
                 </div>
            )}
            */} <main className="space-y-8">
              {/* Input Section */}
              <div className="bg-slate-800 rounded-2xl p-6 md:p-8 shadow-xl border border-slate-700">
                <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                  上传参考图片
                </h2>

                {/* Mode Selection */}
                <div className="flex justify-center mb-6">
                  <div className="bg-slate-900/50 p-1 rounded-lg inline-flex">
                    <button
                      onClick={() => setGenerationMode('sticker-pack')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${generationMode === 'sticker-pack'
                        ? 'bg-yellow-500 text-slate-900 shadow-lg'
                        : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      表情包模式 (Sticker Pack)
                    </button>
                    <button
                      onClick={() => setGenerationMode('christmas-hat')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${generationMode === 'christmas-hat'
                        ? 'bg-yellow-500 text-slate-900 shadow-lg'
                        : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      圣诞帽模式 (Christmas Hat)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Upload Area */}
                  <div className="space-y-4">
                    <div className={`relative border-2 border-dashed rounded-xl p-8 transition-colors text-center flex flex-col items-center justify-center min-h-[300px]
                      ${previewUrl ? 'border-slate-600 bg-slate-900/50' : 'border-slate-600 hover:border-yellow-500/50 hover:bg-slate-700/30 bg-slate-800'}
                    `}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />

                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-h-[260px] w-auto rounded-lg shadow-md object-contain"
                        />
                      ) : (
                        <>
                          <div className="bg-slate-700 p-4 rounded-full mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                          </div>
                          <p className="text-slate-300 font-medium">点击或拖拽上传图片</p>
                          <p className="text-slate-500 text-sm mt-1">支持 JPG, PNG 格式</p>
                        </>
                      )}
                    </div>

                    <Button
                      onClick={handleGenerate}
                      disabled={!selectedFile || state.isLoading}
                      fullWidth
                      className={state.isLoading ? "animate-pulse" : ""}
                    >
                      {state.isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          正在生成...
                        </>
                      ) : '开始生成 (Generate)'}
                    </Button>

                    {state.error && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm break-all whitespace-pre-wrap">
                        {state.error}
                      </div>
                    )}
                  </div>

                  {/* Instructions / Info */}
                  <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-white mb-4">生成配置说明</h3>
                      {generationMode === 'sticker-pack' ? (
                        <ul className="space-y-3 text-slate-400 text-sm">
                          <li className="flex items-start gap-2">
                            <span className="text-yellow-500 mt-1">●</span>
                            <span>模型: <strong>自动选择 (Server Configured)</strong></span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-yellow-500 mt-1">●</span>
                            <span>风格: Q 版, LINE 贴纸风, 手绘彩色</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-yellow-500 mt-1">●</span>
                            <span>布局: 4x6 表情包合集 (生成 24 个表情)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-yellow-500 mt-1">●</span>
                            <span>输出: 自动裁切并打包下载</span>
                          </li>
                        </ul>
                      ) : (
                        <ul className="space-y-3 text-slate-400 text-sm">
                          <li className="flex items-start gap-2">
                            <span className="text-yellow-500 mt-1">●</span>
                            <span>功能: 给角色戴上圣诞帽</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-yellow-500 mt-1">●</span>
                            <span>输出: 单张图片 (无网格)</span>
                          </li>
                        </ul>
                      )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-700/50">
                      <p className="text-xs text-slate-500 italic">
                        提示：请使用光线清晰的单人照片。AI 将保留人物特征（如头饰）并进行风格化处理。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </>
        ) : (
          /* ================= RESULT / PREVIEW VIEW ================= */
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
              <h3 className="text-xl font-semibold text-white">裁切 & 下载工作台</h3>
              <div className="flex gap-3 w-full md:w-auto">
                <Button variant="secondary" onClick={handleBackToHome} className="flex-1 md:flex-none text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  返回主页
                </Button>
                <Button variant="outline" onClick={handleDownloadSingle} className="flex-1 md:flex-none text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  下载原图
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-6 flex flex-col md:flex-row gap-6">
              {/* Controls Sidebar - Only show for Sticker Pack */}
              {generationMode === 'sticker-pack' && (
                <div className="w-full md:w-64 space-y-6 shrink-0 bg-slate-900/50 p-6 rounded-xl border border-slate-700/50 h-fit">
                  <div>
                    <h4 className="text-yellow-500 font-medium mb-4 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      裁切网格设置
                    </h4>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">横向 (列数)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range" min="1" max="10"
                          value={cropCols}
                          onChange={(e) => setCropCols(Number(e.target.value))}
                          className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                        />
                        <span className="w-8 text-center text-white font-mono bg-slate-800 rounded px-1">{cropCols}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">纵向 (行数)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range" min="1" max="10"
                          value={cropRows}
                          onChange={(e) => setCropRows(Number(e.target.value))}
                          className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                        />
                        <span className="w-8 text-center text-white font-mono bg-slate-800 rounded px-1">{cropRows}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700 text-xs text-slate-400">
                    <p className="mb-2">预览框中的黄线显示了分割线。</p>
                    <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                      <p className="text-yellow-500 font-mono text-center">
                        总计: <span className="text-lg">{cropRows * cropCols}</span> 张表情
                      </p>
                    </div>
                  </div>

                  {state.error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs break-all">
                      {state.error}
                    </div>
                  )}
                </div>
              )}

              {/* Preview Area */}
              <div className="flex-1 bg-black/20 rounded-xl border border-slate-700 flex items-center justify-center p-4 overflow-hidden relative min-h-[500px]">
                <div className="relative inline-block shadow-2xl">
                  <img
                    src={state.generatedImage}
                    alt="Crop Preview"
                    className="max-w-full max-h-[70vh] object-contain block"
                  />
                  {/* Grid Overlay */}
                  {generationMode === 'sticker-pack' && (
                    <div
                      className="absolute inset-0 grid border-2 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] pointer-events-none"
                      style={{
                        gridTemplateColumns: `repeat(${cropCols}, 1fr)`,
                        gridTemplateRows: `repeat(${cropRows}, 1fr)`
                      }}
                    >
                      {Array.from({ length: cropRows * cropCols }).map((_, i) => (
                        <div key={i} className="border border-yellow-500/40 shadow-[inset_0_0_2px_rgba(0,0,0,0.1)]"></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-900 border-t border-slate-700 flex justify-end">
              {generationMode === 'sticker-pack' && (
                <Button
                  onClick={handleConfirmCropDownload}
                  disabled={isZipping}
                  className="w-full md:w-auto"
                >
                  {isZipping ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                  {isZipping ? '打包处理中...' : '确认裁切并下载 ZIP'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;