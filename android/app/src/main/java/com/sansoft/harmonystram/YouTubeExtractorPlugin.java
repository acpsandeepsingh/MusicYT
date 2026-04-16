package com.sansoft.harmonystram;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "YouTubeExtractor")
public class YouTubeExtractorPlugin extends Plugin {

    private final YouTubeStreamExtractor extractor = new YouTubeStreamExtractor();

    @PluginMethod
    public void extract(PluginCall call) {
        String videoId = call.getString("videoId");
        Boolean preferVideo = call.getBoolean("preferVideo", false);

        if (videoId == null) {
            call.reject("Must provide a videoId");
            return;
        }

        try {
            YouTubeStreamExtractor.ExtractionResult result = extractor.extract(videoId, preferVideo, 1);
            JSObject ret = new JSObject();
            ret.put("streamUrl", result.streamUrl);
            ret.put("audioStreamUrl", result.audioStreamUrl);
            ret.put("videoStreamUrl", result.videoStreamUrl);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Extraction failed", e);
        }
    }
}
