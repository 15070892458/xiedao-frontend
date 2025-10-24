import { useState, useRef } from "react";
import { ASRClient } from "@/libs/asr-client";


export function useASR() {
    const [transcript, setTranscript] = useState("");
    const [asrStatus, setASRStatus] = useState<'idle' | 'recording'>('idle');
    const [error, setError] = useState<string>('');
    const asrClientRef = useRef<ASRClient | null>(null);

    const startRecording = () => {
        setTranscript("");
        
        // 根据环境选择 WebSocket URL
        let wsUrl: string;
        const deployEnv = process.env.NEXT_PUBLIC_DEPLOY_ENV;
        
        if (deployEnv === 'production') {
            wsUrl = 'wss://xiedao.website/proxy/rtasr';
        } else if (deployEnv === 'test') {
            wsUrl = 'wss://test.xiedao.website/proxy/rtasr';
        } else {
            wsUrl = 'ws://localhost:8080/proxy/rtasr';
        }

        asrClientRef.current = new ASRClient({
            wsUrl,
            onTranscription: setTranscript,
            onStatusChange: setASRStatus,
            onError: setError,
        });
        asrClientRef.current.start();
    };

    const stopRecording = () => {
        asrClientRef.current?.stop();
    };

    return {
        transcript,
        setTranscript,
        asrStatus,
        error,
        startRecording,
        stopRecording,
    };
}