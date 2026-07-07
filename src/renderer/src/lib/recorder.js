/**
 * Microphone recorder that yields the 16kHz mono Float32 samples Whisper wants.
 * start() opens the mic; stop() resolves with the decoded samples.
 */
export function createRecorder() {
    let mediaRecorder = null;
    let chunks = [];
    let stream = null;

    return {
        async start() {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            chunks = [];
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
            mediaRecorder.start();
        },

        async stop() {
            if (!mediaRecorder) return null;
            const done = new Promise((resolve) => { mediaRecorder.onstop = resolve; });
            mediaRecorder.stop();
            await done;
            stream?.getTracks().forEach((t) => t.stop());

            const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
            const buffer = await blob.arrayBuffer();
            // Decode at 16kHz mono — the sample rate Whisper expects.
            const ctx = new AudioContext({ sampleRate: 16000 });
            const audio = await ctx.decodeAudioData(buffer);
            const samples = audio.getChannelData(0).slice();
            ctx.close();
            return samples;
        },

        cancel() {
            try { mediaRecorder?.stop(); } catch { /* not started */ }
            stream?.getTracks().forEach((t) => t.stop());
        },
    };
}
