import { registerPlugin } from '@capacitor/core';

export interface YouTubeExtractorPlugin {
  extract(options: { videoId: string; preferVideo?: boolean }): Promise<{
    streamUrl: string;
    audioStreamUrl?: string;
    videoStreamUrl?: string;
  }>;
}

const YouTubeExtractor = registerPlugin<YouTubeExtractorPlugin>('YouTubeExtractor');

export default YouTubeExtractor;
