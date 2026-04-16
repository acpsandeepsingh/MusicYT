package com.sansoft.harmonystram;

public class YouTubeUrlNormalizer {
    public static String normalizeWatchUrl(String videoIdOrUrl) {
        if (videoIdOrUrl == null) return "";
        if (videoIdOrUrl.startsWith("http")) return videoIdOrUrl;
        if (videoIdOrUrl.length() == 11) {
            return "https://www.youtube.com/watch?v=" + videoIdOrUrl;
        }
        return videoIdOrUrl;
    }
}
