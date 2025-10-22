import { useState, useRef } from "react";
import { ASRClient } from "@/libs/asr-client";


export function useASR() {
    const [transcript, setTranscript] = useState("");
    const [asrStatus, setASRStatus] = useState<'idle' | 'recording'>('idle');
    const [error, setError] = useState<string>('');
    const asrClientRef = useRef<ASRClient | null>(null);

    const startRecording = () => {
        setTranscript("");
        const wsUrl = process.env.NEXT_PUBLIC_DEPLOY_ENV === 'production'
            ? 'wss://xiedao.website/proxy/rtasr'
            : 'ws://localhost:8080/proxy/rtasr';

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