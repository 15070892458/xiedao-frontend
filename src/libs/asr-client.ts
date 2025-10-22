// AI gen

export interface ASRClientOptions {
  wsUrl: string;
  onTranscription?: (text: string) => void;       // called whenever text updates
  onError?: (error: string) => void;              // called on errors
  onStatusChange?: (status: 'idle' | 'recording') => void;
}

export class ASRClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private finalResult: string[] = [];
  private options: ASRClientOptions;

  constructor(options: ASRClientOptions) {
    this.options = options;
  }

  private handleRecognitionData = (message: string): string => {
    const tempResult: string[] = [];
    try {
      const messageObj = JSON.parse(message);
      const cn = messageObj.cn || {};
      const st = cn.st || {};
      const rtArr = st.rt || [];

      for (const rtObj of rtArr) {
        for (const wsObj of rtObj.ws || []) {
          for (const cwObj of wsObj.cw || []) {
            tempResult.push(cwObj.w || '');
          }
        }
      }

      if (st.type === '1') {
        // real-time text
        return tempResult.join('');
      } else if (st.type === '0') {
        // final text
        this.finalResult.push(tempResult.join(''));
        return '';
      }
      return tempResult.join('');
    } catch (e) {
      console.error('Parse error:', e);
      return message;
    }
  };

  public start = async () => {
    try {
      this.finalResult = [];
      this.options.onError?.('');
      this.options.onStatusChange?.('recording');

      // 1. get mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      this.mediaStream = stream;

      // 2. open WebSocket
      this.ws = new WebSocket(this.options.wsUrl);
      this.ws.onopen = () => this.startAudioProcessing(stream);

      this.ws.onmessage = async (e) => {
        let text = typeof e.data === 'string' ? e.data : await (e.data as Blob).text();
        try {
          const data = JSON.parse(text);
          if (data.code !== '0') {
            const errMsg = `Error Code: ${data.code}, Message: ${data.desc || 'Unknown'}`;
            this.options.onError?.(errMsg);
            this.stop();
            return;
          }
          if (data.data) {
            const realTime = this.handleRecognitionData(data.data);
            this.options.onTranscription?.(this.finalResult.join('') + realTime);
          }
        } catch (err) {
          console.error('Invalid message:', err);
        }
      };

      this.ws.onerror = () => {
        this.options.onError?.('WebSocket error');
        this.stop();
      };

      this.ws.onclose = () => this.options.onStatusChange?.('idle');
    } catch (err) {
      console.error(err);
      this.options.onError?.('Failed to access microphone');
      this.options.onStatusChange?.('idle');
    }
  };

  private startAudioProcessing(stream: MediaStream) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(stream);
    const processor = this.audioContext.createScriptProcessor(2048, 1, 1);
    this.processor = processor;

    let buffer: number[] = [];
    const targetChunk = 1280;

    processor.onaudioprocess = (e) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);

      for (let i = 0; i < input.length; i++) {
        buffer.push(input[i]);
        if (buffer.length >= targetChunk) {
          const chunk = buffer.splice(0, targetChunk);
          const pcm = new Int16Array(chunk.length);
          for (let j = 0; j < chunk.length; j++) {
            const s = Math.max(-1, Math.min(1, chunk[j]));
            pcm[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          this.ws.send(pcm.buffer);
        }
      }
    };

    source.connect(processor);
    processor.connect(this.audioContext.destination);
  }

  public stop = () => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ end: true }));
      this.ws.close();
    }
    this.processor?.disconnect();
    this.processor = null;
    this.audioContext?.close();
    this.audioContext = null;
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.mediaStream = null;
    // TODO: Temporary fix for avoiding status flicking causing tsx state change issues.
    setTimeout(() => this.options.onStatusChange?.('idle'), 100);
  };
}
