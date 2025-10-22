"use client";
import { useEffect, useState, useRef } from "react";
import { useCompletion } from "@ai-sdk/react";
import { useASR } from "@/hooks/use-asr";
import { Mic, Eye, X, Copy, Check } from "lucide-react";

export default function Home() {
  const [textLLM, setTextLLM] = useState<string>("");

  const { transcript, asrStatus, error, startRecording, stopRecording } = useASR();
  const { completion, input, setInput, handleSubmit, isLoading } = useCompletion({
    api: process.env.NEXT_PUBLIC_API_URL + "/api/completion",
    onFinish: (_: string, completion: string) => {
      setTextLLM(completion);
    },
  });

  const [pageState, setPageState] = useState<"start" | "countdown" | "recording" | "animating" | "main">("start");
  const [countdown, setCountdown] = useState(3); // 倒计时：3, 2, 1
  const [showOriginal, setShowOriginal] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [shouldSubmit, setShouldSubmit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLowVolumeWarning, setShowLowVolumeWarning] = useState(false);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [isFirstRecording, setIsFirstRecording] = useState(true); // 是否第一次录音
  const touchStartRef = useRef<{ distance: number } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const lowVolumeStartTimeRef = useRef<number | null>(null);

  // 处理麦克风错误
  useEffect(() => {
    if (error) {
      console.error("ASR Error:", error);
      
      const errorMessage = error.toString().toLowerCase();
      
      if (errorMessage.includes('notfound') || errorMessage.includes('device not found')) {
        setMicrophoneError("无法使用麦克风，请检查权限设置");
      } else if (errorMessage.includes('notallowed') || errorMessage.includes('permission')) {
        setMicrophoneError("无法使用麦克风，请检查权限设置");
      } else if (errorMessage.includes('notreadable') || errorMessage.includes('in use')) {
        setMicrophoneError("麦克风遇到问题，请联系我们处理");
      } else {
        setMicrophoneError("麦克风遇到问题，请联系我们处理");
      }
    } else {
      setMicrophoneError(null);
    }
  }, [error]);

  // 倒计时逻辑
  useEffect(() => {
    if (pageState === "countdown") {
      if (countdown > 0) {
        const timer = setTimeout(() => {
          setCountdown(countdown - 1);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        // 倒计时结束，开始录音
        setPageState("recording");
        startRecording();
        setCountdown(3); // 重置倒计时
      }
    }
  }, [pageState, countdown]);

  useEffect(() => {
    if (asrStatus === "recording" && pageState === "recording") {
      startAudioMonitoring();
      recordingStartTimeRef.current = Date.now();
      lowVolumeStartTimeRef.current = Date.now();
    } else {
      stopAudioMonitoring();
      setShowLowVolumeWarning(false);
      recordingStartTimeRef.current = 0;
      lowVolumeStartTimeRef.current = null;
    }
    
    return () => stopAudioMonitoring();
  }, [asrStatus, pageState]);

  useEffect(() => {
    if (isLoading && pageState === "recording") {
      if (isFirstRecording) {
        // 第一次录音：播放动画
        setPageState("animating");
        setTimeout(() => {
          setPageState("main");
          setIsFirstRecording(false);
        }, 1000);
      } else {
        // 后续录音：直接跳转
        setPageState("main");
      }
    }
  }, [isLoading, pageState, isFirstRecording]);

  useEffect(() => {
    if (shouldSubmit && asrStatus === "idle") {
      setInput(generateUserInput(textLLM.slice(10, -11), transcript));
      setTimeout(() => {
        if (formRef.current) {
          formRef.current.requestSubmit();
        }
        setShouldSubmit(false);
      }, 100);
    }
  }, [shouldSubmit, asrStatus, transcript, textLLM, setInput]);

  useEffect(() => {
    if (pageState === "recording" && recordingStartTimeRef.current > 0) {
      const currentTime = Date.now();

      if (audioLevel > 0.15) {
        lowVolumeStartTimeRef.current = null;
        setShowLowVolumeWarning(false);
      } else {
        if (lowVolumeStartTimeRef.current === null) {
          lowVolumeStartTimeRef.current = currentTime;
        }

        const lowVolumeDuration = currentTime - lowVolumeStartTimeRef.current;

        if (lowVolumeDuration > 8000) {
          setShowLowVolumeWarning(true);
        }
      }
    }
  }, [audioLevel, pageState]);

  const startAudioMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (analyserRef.current && pageState === "recording") {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };
      
      updateLevel();
    } catch (err) {
      console.error("Audio monitoring error:", err);
    }
  };

  const stopAudioMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const handleFirstClick = () => {
    setPageState("countdown");
  };

  const handleRestartRecording = () => {
    setPageState("countdown"); // 直接开始倒计时，不播放动画
  };

  const handleCopy = async () => {
    const textToCopy = showOriginal ? transcript : textLLM.slice(10, -11);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pageState === "main") {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = { distance };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current && pageState === "main") {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const diff = distance - touchStartRef.current.distance;
      
      if (diff < -50 && !showOriginal) {
        setShowOriginal(true);
        touchStartRef.current = null;
      } else if (diff > 50 && showOriginal) {
        setShowOriginal(false);
        touchStartRef.current = null;
      }
    }
  };

  // 开始页面
  if (pageState === "start") {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 50% 108.4% at 50% 50%, #F4F4F5 0%, #D5D5D5 100%)'
        }}
      >
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={handleFirstClick}
            className="w-40 h-40 rounded-full bg-white border-4 border-zinc-200 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center shadow-xl"
            aria-label="开始录音"
          >
            <Mic className="w-20 h-20 text-zinc-600" strokeWidth={2} />
          </button>
          <div className="flex items-center gap-1">
            <span className="text-zinc-600 text-lg font-bold">写道</span>
            <span className="text-zinc-600 text-xl font-bold">Renaissance</span>
          </div>
        </div>
      </div>
    );
  }

  // 倒计时页面
  if (pageState === "countdown") {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 50% 108.4% at 50% 50%, #F4F4F5 0%, #D5D5D5 100%)'
        }}
      >
        {/* ✅ 修改1：pt-72 → pt-48，text-neutral-500 → text-gray-400 */}
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-48">
          <span className="text-gray-400 text-sm">倒计时:</span>
        </div>

        <div className="flex flex-col items-center gap-6">
          {/* ✅ 修改2：w-36 h-36 → w-40 h-40 */}
          <div className="w-40 h-40 rounded-full bg-[#E9BA87] border-4 border-[#EECBA5] flex items-center justify-center shadow-xl">
            <span className="text-white text-6xl font-bold">{countdown}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-zinc-600 text-lg font-bold">写道</span>
            <span className="text-zinc-600 text-xl font-bold">Renaissance</span>
          </div>
        </div>
      </div>
    );
  }

  // 录音页面
  if (pageState === "recording") {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 50% 108.4% at 50% 50%, #F4F4F5 0%, #D5D5D5 100%)'
        }}
      >
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-48">
          <span className="text-gray-400 text-sm">录制中</span>
        </div>

        {/* 麦克风错误弹窗 */}
        {microphoneError && (
          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 px-4 py-3 bg-white rounded-lg shadow-lg border border-neutral-200 flex items-center gap-2 z-50 animate-fade-in max-w-sm">
            <div className="w-5 h-5 rounded-full border-2 border-zinc-900 flex items-center justify-center flex-shrink-0">
              <span className="text-zinc-900 text-sm font-bold">!</span>
            </div>
            <span className="text-zinc-900 text-sm">{microphoneError}</span>
          </div>
        )}

        {/* 音量低警告弹窗 */}
        {showLowVolumeWarning && !microphoneError && (
          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 px-4 py-3 bg-white rounded-lg shadow-lg border border-neutral-200 flex items-center gap-2 z-50 animate-fade-in max-w-sm">
            <div className="w-5 h-5 rounded-full border-2 border-zinc-900 flex items-center justify-center flex-shrink-0">
              <span className="text-zinc-900 text-sm font-bold">!</span>
            </div>
            <span className="text-zinc-900 text-sm">没检测到声音或声音过小，在设置调整您的麦克风？</span>
          </div>
        )}

        <div className="flex flex-col items-center gap-6">
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
            <input type="hidden" name="prompt" value={input} />

            <button
              type="button"
              onClick={() => {
                stopRecording();
                setShouldSubmit(true);
              }}
              className="w-40 h-40 rounded-full bg-[#E9BA87] border-4 border-[#EECBA5] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center shadow-xl animate-pulse-glow"
              aria-label="停止录音"
            >
              <Mic className="w-20 h-20 text-white" strokeWidth={2} />
            </button>
            
            <div className="flex items-center gap-1">
              <span className="text-zinc-600 text-lg font-bold">写道</span>
              <span className="text-zinc-600 text-xl font-bold">Renaissance</span>
            </div>
          </form>
        </div>

        <style jsx>{`
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 20px rgba(233, 186, 135, 0.4); }
            50% { box-shadow: 0 0 40px rgba(233, 186, 135, 0.8); }
          }
          .animate-pulse-glow {
            animation: pulseGlow 1.5s ease-in-out infinite;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -10px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
          .animate-fade-in {
            animation: fadeIn 0.3s ease-out;
          }
        `}</style>
      </div>
    );
  }

  // 动画页面（只有第一次）
  if (pageState === "animating") {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 50% 108.4% at 50% 50%, #F4F4F5 0%, #D5D5D5 100%)'
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-expand-circle bg-white rounded-full flex items-center justify-center border-4 border-zinc-200">
            <Mic className="w-20 h-20 text-zinc-600 animate-fade-out" strokeWidth={2} />
          </div>
        </div>

        <style jsx>{`
          @keyframes expandCircle {
            0% {
              width: 10rem;
              height: 10rem;
              opacity: 1;
            }
            60% {
              width: 300vmax;
              height: 300vmax;
              opacity: 0.8;
            }
            100% {
              width: 300vmax;
              height: 300vmax;
              opacity: 0;
            }
          }

          @keyframes fadeOut {
            0% { opacity: 1; }
            30% { opacity: 0; }
            100% { opacity: 0; }
          }

          .animate-expand-circle {
            width: 10rem;
            height: 10rem;
            animation: expandCircle 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }

          .animate-fade-out {
            animation: fadeOut 0.6s ease-out forwards;
          }
        `}</style>
      </div>
    );
  }

  // 结果页面
  return (
    <div 
      className="fixed inset-0 bg-white flex flex-col overflow-hidden animate-page-fade-in"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div className="w-full px-6 pt-9 pb-4 flex items-center justify-between flex-shrink-0">
        {!showOriginal ? (
          <>
            <div className="flex items-center gap-1">
              <span className="text-zinc-600 text-lg font-bold">写道</span>
              <span className="text-zinc-600 text-xl font-bold">Renaissance</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="w-10 h-10 bg-zinc-50 rounded-full shadow-sm border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 transition-colors"
                aria-label="复制文本"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-600" strokeWidth={1.5} />
                ) : (
                  <Copy className="w-5 h-5 text-zinc-600" strokeWidth={1.5} />
                )}
              </button>
              <button
                onClick={() => setShowOriginal(true)}
                className="w-10 h-10 bg-zinc-50 rounded-full shadow-sm border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 transition-colors"
                aria-label="查看原文"
              >
                <Eye className="w-5 h-5 text-zinc-600" strokeWidth={1.5} />
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="text-zinc-600 text-xl font-bold">您的录音原文</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="w-10 h-10 bg-zinc-50 rounded-full shadow-sm border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 transition-colors"
                aria-label="复制原文"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-600" strokeWidth={1.5} />
                ) : (
                  <Copy className="w-5 h-5 text-zinc-600" strokeWidth={1.5} />
                )}
              </button>
              <button
                onClick={() => setShowOriginal(false)}
                className="w-10 h-10 bg-zinc-50 rounded-full shadow-sm border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 transition-colors"
                aria-label="返回处理后文本"
              >
                <X className="w-5 h-5 text-zinc-600" strokeWidth={1.5} />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 px-6 overflow-auto">
        <p className="text-zinc-900 text-base leading-relaxed whitespace-pre-wrap">
          {showOriginal 
            ? (transcript || "暂无录音内容")
            : (!isLoading || asrStatus === "recording"
                ? textLLM.slice(10, -11) || "点击下方按钮开始录音..."
                : completion.slice(10) || "正在处理..."
              )
          }
        </p>
      </div>

      {!showOriginal && (
        <div className="w-full px-6 pb-20 pt-6 flex flex-col items-center gap-4 flex-shrink-0">
          <button
            type="button"
            onClick={handleRestartRecording}
            disabled={isLoading}
            className="w-20 h-20 rounded-full border-2 bg-zinc-100 border-zinc-200 hover:bg-zinc-200 disabled:opacity-50 flex items-center justify-center transition-all"
          >
            <Mic className="w-10 h-10 text-zinc-600" strokeWidth={2} />
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes pageFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-page-fade-in {
          animation: pageFadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

function generateUserInput(oldText: string, transcript: string): string {
  return `<old_text>${oldText}</old_text><speech>${transcript}</speech>`;
}