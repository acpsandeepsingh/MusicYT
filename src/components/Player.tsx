import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, ListMusic, Video, Music, Maximize2, Volume1, VolumeX } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { motion, AnimatePresence } from 'motion/react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { getSongCoverUrl } from '../lib/song-utils';
import { Capacitor } from '@capacitor/core';
import YouTubeExtractor from '../lib/native-bridge';
import { cn } from '../lib/utils';

// Forceful Media Session Anchor: A MUCH longer silent mp3 to take control of media session from the OS
// This is 30 seconds of silence to reduce loop overhead and prevent OS metadata clearing.
const SILENT_AUDIO = "data:audio/mp3;base64,SUQzBAAAAAABAFRyYWNrABAgAAAAYmxhbmsA//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAlAAALXwAHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcX//////////////////////////////////////////////////////////////////8AAABhTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV8=";

export default function Player() {
  const { 
    currentSong, 
    isPlaying, 
    togglePlay, 
    next, 
    previous, 
    volume, 
    setVolume,
    progress,
    duration,
    updateProgress,
    setDuration,
    setPlayer,
    player,
    queue,
    currentIndex,
    showToast,
    playerMode,
    setPlayerMode,
    playerType,
    setPlayerType
  } = usePlayerStore();

  const [showQueue, setShowQueue] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isUserInactive, setIsUserInactive] = useState(false);
  const [videoZoom, setVideoZoom] = useState<number>(1);
  const canUnmute = useRef<boolean>(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<number | null>(null);
  const loadTimeout = useRef<number | null>(null);
  const stuckCheckInterval = useRef<number | null>(null);
  const lastUnmuteAttempt = useRef<number>(0);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const lastKnownVideoId = useRef<string | null>(null);
  const isInternalSkip = useRef<boolean>(false);
  const inactivityTimeout = useRef<number | null>(null);
  const metadataSyncTimer = useRef<number | null>(null);
  const silentAnchorRef = useRef<HTMLAudioElement | null>(null);

  const handleSeek = useCallback((pos: number) => {
    if (playerType === 'youtube' && player) {
      try {
        player.seekTo(pos, true);
        if (isPlaying) player.playVideo();
      } catch (e) {}
    } else if (audioRef.current) {
      audioRef.current.currentTime = pos;
    }
    updateProgress(pos);
  }, [playerType, player, isPlaying, updateProgress]);

  // Handle inactivity for hiding cursor/UI in video mode
  useEffect(() => {
    const handleMouseMove = () => {
      setIsUserInactive(false);
      if (inactivityTimeout.current) window.clearTimeout(inactivityTimeout.current);
      inactivityTimeout.current = window.setTimeout(() => {
        if (playerMode === 'video') setIsUserInactive(true);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (inactivityTimeout.current) window.clearTimeout(inactivityTimeout.current);
    };
  }, [playerMode]);

  // Fullscreen logic
  const enterFullscreen = async () => {
    const container = playerContainerRef.current;
    if (!container) return;

    try {
      if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if ((container as any).webkitRequestFullscreen) {
        await (container as any).webkitRequestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen failed", err);
    }
  };

  const exitFullscreen = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error("Exit fullscreen failed", err);
      }
    }
  };

  useEffect(() => {
    if (playerMode === 'video' && !document.fullscreenElement) {
      enterFullscreen();
    } else if (playerMode === 'audio' && document.fullscreenElement) {
      exitFullscreen();
    }
  }, [playerMode]);

  // Listen for fullscreen change to sync playerMode
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && playerMode === 'video') {
        setPlayerMode('audio');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [playerMode, setPlayerMode]);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (playerMode === 'video') {
      e.preventDefault();
    }
  };

  const togglePlayerMode = () => {
    setPlayerMode(playerMode === 'audio' ? 'video' : 'audio');
  };

  // Prime audio context on first user interaction
  useEffect(() => {
    const primeAudio = () => {
      console.log('User interaction detected, priming audio context');
      setHasInteracted(true);
      // Try to play/pause a silent audio to unlock the context
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
        }).catch(() => {});
      }
      window.removeEventListener('mousedown', primeAudio);
      window.removeEventListener('keydown', primeAudio);
    };
    window.addEventListener('mousedown', primeAudio);
    window.addEventListener('keydown', primeAudio);
    return () => {
      window.removeEventListener('mousedown', primeAudio);
      window.removeEventListener('keydown', primeAudio);
    };
  }, []);

  useEffect(() => {
    if (isPlaying && playerType === 'youtube' && player) {
      stuckCheckInterval.current = window.setInterval(() => {
        try {
          const state = player.getPlayerState?.();
          // State 2 = Paused, -1 = Unstarted, 5 = Cued
          if (state === 2 || state === -1 || state === 5) {
            console.log('Detected stuck player, state:', state);
            
            // If we've interacted but it's still stuck, try to force play
            if (hasInteracted) {
              player.playVideo?.();
            }
          }
        } catch (e) {}
      }, 3000);
    } else {
      if (stuckCheckInterval.current) clearInterval(stuckCheckInterval.current);
    }
    return () => {
      if (stuckCheckInterval.current) clearInterval(stuckCheckInterval.current);
    };
  }, [isPlaying, playerType, player, hasInteracted]);

  const handleTogglePlay = () => {
    console.log('User toggled play/pause');
    setHasInteracted(true);
    canUnmute.current = true;
    
    if (player && playerType === 'youtube') {
      try {
        if (!isPlaying) {
          player.playVideo();
        } else {
          player.pauseVideo();
        }
      } catch (e) {
        console.error('Error in handleTogglePlay (YouTube):', e);
      }
    } else if (audioRef.current && playerType === 'audio') {
      if (!isPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
    
    togglePlay();
  };

  // Media Session Integration - Aggressive Metadata Sync
  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return;

    const updateMetadata = () => {
      try {
        const state = usePlayerStore.getState();
        const { queue } = state;
        const realIndex = queue.findIndex(s => s.id === currentSong.id);
        const nextIndex = (realIndex + 1) % queue.length;
        const nextSong = queue.length > 1 ? queue[nextIndex] : null;
        
        let artistDisplay = currentSong.artist;
        let albumDisplay = currentSong.album || 'Harmony Stream';

        if (nextSong && nextSong.id !== currentSong.id) {
          artistDisplay = `${currentSong.artist} • NEXT: ${nextSong.title}`;
          albumDisplay = `⏭️ Next: ${nextSong.title} (+${queue.length - (realIndex + 1)} in queue)`;
        }

        console.log('MEDIA_SYNC: Updating metadata for', currentSong.title);
        
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: artistDisplay,
          album: albumDisplay,
          artwork: [
            { src: getSongCoverUrl(currentSong, 'default'), sizes: '96x96', type: 'image/jpeg' },
            { src: getSongCoverUrl(currentSong, 'mqdefault'), sizes: '128x128', type: 'image/jpeg' },
            { src: getSongCoverUrl(currentSong, 'hqdefault'), sizes: '192x192', type: 'image/jpeg' },
            { src: getSongCoverUrl(currentSong, 'sddefault'), sizes: '256x256', type: 'image/jpeg' },
            { src: getSongCoverUrl(currentSong, 'maxresdefault'), sizes: '512x512', type: 'image/jpeg' },
          ],
        });
      } catch (e) {
        console.warn('Metadata Sync Error:', e);
      }
    };

    updateMetadata();
    
    // Multiple syncs to ensure we stick through iframe changes
    const timers = [1000, 3000, 7000].map(delay => setTimeout(updateMetadata, delay));

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [currentSong, queue]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    console.log('MediaSession: Registering handlers with type', playerType);

    const handlePlayAction = () => {
      console.log('MediaSession: Play Clicked');
      const state = usePlayerStore.getState();
      if (!state.isPlaying) {
        if (state.playerType === 'youtube' && state.player) state.player.playVideo();
        if (state.playerType === 'audio' && audioRef.current) audioRef.current.play();
        state.togglePlay();
      }
    };

    const handlePauseAction = () => {
      console.log('MediaSession: Pause Clicked');
      const state = usePlayerStore.getState();
      if (state.isPlaying) {
        if (state.playerType === 'youtube' && state.player) state.player.pauseVideo();
        if (state.playerType === 'audio' && audioRef.current) audioRef.current.pause();
        state.togglePlay();
      }
    };

    const handleNextAction = () => {
      console.log('MediaSession: Next Clicked (Direct API Path)');
      const state = usePlayerStore.getState();
      if (state.playerType === 'youtube' && state.player) {
        // Use YouTube's native skip to satisfy the OS "Next" signal
        state.player.nextVideo();
      } else {
        state.next();
      }
    };

    const handlePrevAction = () => {
      console.log('MediaSession: Previous Clicked (Direct API Path)');
      const state = usePlayerStore.getState();
      if (state.playerType === 'youtube' && state.player) {
        state.player.previousVideo();
      } else {
        state.previous();
      }
    };

    const actions: [MediaSessionAction, () => void][] = [
      ['play', handlePlayAction],
      ['pause', handlePauseAction],
      ['nexttrack', handleNextAction],
      ['previoustrack', handlePrevAction],
      ['stop', handlePauseAction],
    ];

    actions.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {
        console.warn(`Action failed: ${action}`, e);
      }
    });

    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) handleSeek(details.seekTime);
      });
    } catch (e) {}

    console.log('MediaSession: Handlers registered successfully');
  }, [handleSeek, playerType]);

  // The Silent Audio Anchor Logic - Permanent context
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const anchor = silentAnchorRef.current;
    if (!anchor) return;

    const startAnchor = async () => {
      try {
        if (isPlaying) {
          await anchor.play();
        } else {
          anchor.pause();
        }
      } catch (e) {
        console.log('Anchor play deferred until interaction');
      }
    };

    startAnchor();
    
    // Force playback state
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if ('mediaSession' in navigator && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1,
          position: Math.min(progress, duration)
        });
      } catch (e) {}
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [duration, progress, isPlaying]);

  useEffect(() => {
    if (!currentSong) return;
    
    console.log('Current Song changed:', currentSong.title);
    
    const videoId = currentSong.videoId || currentSong.youtubeId;
    
    const startPlayback = async () => {
      console.log('Starting playback for:', videoId);
      canUnmute.current = true; // Reset unmute permission for new song
      // Clear any existing load timeout
      if (loadTimeout.current) window.clearTimeout(loadTimeout.current);

      // Reset audio player
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }

      // 1. Try Native Extraction ONLY if on Android/iOS
      if (Capacitor.isNativePlatform() && videoId) {
        setPlayer(null); // Clear YouTube player if switching to native audio
        try {
          console.log('[Native] Attempting extraction for:', videoId);
          const result = await YouTubeExtractor.extract({ videoId });
          if (result.audioStreamUrl) {
            console.log('[Native] Extraction successful');
            setPlayerType('audio');
            if (audioRef.current) {
              audioRef.current.src = result.audioStreamUrl;
              if (isPlaying) {
                audioRef.current.play().catch(err => {
                  console.error('Native Audio play error:', err);
                  setPlayerType('youtube');
                });
              }
            }
            return;
          }
        } catch (err) {
          console.error('[Native] Extraction failed:', err);
        }
      }

      // 2. On Web, always use YouTube player for reliability
      // Audio extraction on web is unreliable due to IP-locking and CORS
      if (videoId) {
        console.log('[Web] Defaulting to YouTube player for reliability');
        setPlayerType('youtube');
        // If player already exists, load the new video
        if (player) {
          try {
            player.loadVideoById(videoId);
            if (isPlaying) player.playVideo();
          } catch (e) {
            console.error('Error loading video in existing player:', e);
          }
        }
      } else {
        showToast('No video ID found for this song', 'error');
      }
    };

    startPlayback();
    
    return () => {
      if (loadTimeout.current) window.clearTimeout(loadTimeout.current);
    };
  }, [currentSong]);

  // Handle Play/Pause synchronization
  useEffect(() => {
    try {
      if (!currentSong) return;
      
      console.log('Syncing player state:', { isPlaying, playerType, hasPlayer: !!player });
      
      if (playerType === 'youtube' && player) {
        if (isPlaying) {
          player.playVideo?.();
        } else {
          player.pauseVideo?.();
        }
      } else if (playerType === 'audio' && audioRef.current) {
        if (isPlaying) {
          if (audioRef.current.src) {
            audioRef.current.play().catch(err => console.error('Audio play error:', err));
          }
        } else {
          audioRef.current.pause();
        }
      }
    } catch (e) {
      console.error('Error in sync effect:', e);
    }
  }, [isPlaying, player, playerType, currentSong]);

  // Handle Volume synchronization
  useEffect(() => {
    const volLevel = volume; // 0 to 1
    if (playerType === 'audio' && audioRef.current) {
      audioRef.current.volume = volLevel;
    } else if (playerType === 'youtube' && player) {
      try {
        player.setVolume?.(volLevel * 100);
      } catch (e) {}
    }
  }, [volume, player, playerType]);

  // Progress Tracking using shared logic
  useEffect(() => {
    if (isPlaying) {
      progressInterval.current = window.setInterval(() => {
        let currentTime = 0;
        try {
          if (playerType === 'youtube' && player) {
            currentTime = player.getCurrentTime() || 0;
          } else if (playerType === 'audio' && audioRef.current) {
            currentTime = audioRef.current.currentTime || 0;
          }
          if (currentTime > 0) updateProgress(currentTime);
        } catch (e) {}
      }, 1000);
    } else {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying, player, playerType, updateProgress]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!player || playerType !== 'youtube' || !currentSong) return;
    
    const activeId = currentSong.videoId || currentSong.youtubeId;
    if (!activeId) return;

    // The Critical Fix: If YouTube has already transitioned internally,
    // we MUST NOT call loadPlaylist/loadVideoById as it resets the Media Session.
    if (activeId !== lastKnownVideoId.current) {
      if (isInternalSkip.current) {
        console.log('API SYNC: Song changed internally, already correct in player.');
        lastKnownVideoId.current = activeId;
        isInternalSkip.current = false;
        return;
      }

      console.log('API FORCE: Manual track change, updating player state.');
      lastKnownVideoId.current = activeId;
      
      const nextIds = queue
        .slice(currentIndex)
        .map(s => s.videoId || s.youtubeId)
        .filter(id => id && id !== '')
        .slice(0, 40);

      if (nextIds.length > 1) {
        player.loadPlaylist(nextIds, 0);
      } else {
        player.loadVideoById(activeId);
      }
    }
  }, [currentSong, player, playerType, queue, currentIndex]);

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    console.log('YouTube Player Ready, restoring progress if any:', progress);
    setPlayer(event.target);
    event.target.setVolume(volume * 100);
    
    // Restore progress if switching modes for the same song
    if (progress > 0) {
      try {
        event.target.seekTo(progress, true);
      } catch (e) {}
    }

    if (isPlaying && playerType === 'youtube') {
      setTimeout(() => {
        try {
          if (hasInteracted) {
            console.log('Attempting unmuted autoplay in onReady (user interacted)');
            event.target.playVideo();
            // Fallback: if it's still muted 
            setTimeout(() => {
              if (event.target.isMuted()) event.target.unMute();
            }, 500);
          } else {
            console.log('Attempting muted autoplay in onReady (no interaction)');
            event.target.mute();
            event.target.playVideo();
          }
        } catch (e) {
          console.error('Error playing video in onReady:', e);
        }
      }, 100);
    }
  };

  const onPlayerError: YouTubeProps['onError'] = (event) => {
    const errorMessages: Record<number, string> = {
      2: 'Invalid parameter',
      5: 'HTML5 player error',
      100: 'Video not found or removed',
      101: 'Playback not allowed in embedded players',
      150: 'Playback not allowed in embedded players'
    };
    const errorMsg = errorMessages[event.data] || 'Unknown error';
    console.error('YouTube Player Error:', { code: event.data, message: errorMsg });
    showToast(`YouTube error: ${errorMsg}. Skipping...`, 'error');
    next();
  };

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    console.log('YouTube State Change:', event.data);
    
    // Enhanced check on every state change to keep OS and App perfectly aligned
    if (event.data === 1 || event.data === 2 || event.data === 3) {
      try {
        const url = event.target.getVideoUrl();
        const videoId = currentSong?.videoId || currentSong?.youtubeId;
        
        if (url && videoId) {
          if (!url.includes(videoId)) {
            // This is the OS/Playlist skip detection
            console.log('SYNC: Detected track switch via native controls.');
            isInternalSkip.current = true;
            usePlayerStore.getState().next();
          } else {
            lastKnownVideoId.current = videoId;
          }
        }
      } catch (e) {}
    }

    if (event.data === -1 && isPlaying) {
      setTimeout(() => {
        try {
          console.log('Attempting muted autoplay in onStateChange');
          event.target.mute();
          event.target.playVideo();
        } catch (e) {}
      }, 500);
    }
    
    if (event.data === 0) { // Ended
      next();
    }
    
    if (event.data === 1 && playerType === 'youtube') { // Playing
      console.log('Video is playing');
      setDuration(event.target.getDuration());
      
      if (hasInteracted && canUnmute.current) {
        // Quick unmute if user has already interacted
        try {
          if (event.target.isMuted()) {
            event.target.unMute();
            setIsMuted(false);
          }
        } catch (e) {}
      }
    }

    // If it pauses while it should be playing, it might be an autoplay block
    if (event.data === 2 && isPlaying) {
      const timeSinceUnmute = Date.now() - lastUnmuteAttempt.current;
      if (timeSinceUnmute < 2000 && lastUnmuteAttempt.current > 0) {
        console.log('Detected pause immediately after unmute, likely autoplay block. Re-muting and locking unmute.');
        try {
          canUnmute.current = false; // Lock unmuting for this song until next interaction
          event.target.mute();
          setIsMuted(true);
          event.target.playVideo();
        } catch (e) {}
      }
    }
  };

  const handleAudioMetadata = () => {
    console.log('Audio Metadata Loaded, progress:', progress);
    if (loadTimeout.current) window.clearTimeout(loadTimeout.current);
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      if (progress > 0) {
        audioRef.current.currentTime = progress;
      }
    }
  };

  const handleAudioPlaying = () => {
    console.log('Audio Playing');
    if (loadTimeout.current) window.clearTimeout(loadTimeout.current);
  };

  const handleAudioEnded = () => {
    console.log('Audio Ended');
    next();
  };

  const handleAudioError = (e: any) => {
    if (playerType !== 'audio') return;

    const errorCode = e.target?.error?.code;
    const errorMessage = e.target?.error?.message;
    console.error('Audio play error:', { code: errorCode, message: errorMessage });
    
    const videoId = currentSong?.videoId || currentSong?.youtubeId;
    if (videoId) {
      console.log('Falling back to YouTube player instantly due to error');
      showToast('Audio stream failed. Switching to YouTube...', 'info');
      setPlayerType('youtube');
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
    } else {
      showToast('Playback failed. Skipping to next...', 'error');
      next();
    }
  };

  const ytOpts: YouTubeProps['opts'] = useMemo(() => {
    // We only provide the initial playlist. Future changes are handled via API to avoid re-mounting.
    const initialPlaylist = queue
      .slice(currentIndex)
      .map(s => s.videoId || s.youtubeId)
      .filter(id => id && id !== '')
      .slice(0, 40);

    return {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 1,
        controls: playerMode === 'video' ? 1 : 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 1,
        showinfo: 0,
        enablejsapi: 1,
        widget_referrer: window.location.href,
        mute: 1,
        playsinline: 1,
        origin: window.location.origin,
        listType: initialPlaylist.length > 1 ? 'playlist' : undefined,
        playlist: initialPlaylist.length > 1 ? initialPlaylist.join(',') : undefined,
      },
    };
    // Crucially: omit currentIndex/currentSong from dependencies to prevent re-renders on skip
    // We handle skipping via the side-effect useEffect [currentSong]
  }, [playerMode, queue]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (player && playerType === 'youtube') {
        try {
          const state = player.getPlayerState?.();
          console.log('Current Player State:', state);
          if (isPlaying && (state === -1 || state === 2 || state === 5)) {
            console.log('Aggressive force play');
            player.playVideo?.();
          }
        } catch (e) {}
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [player, playerType, isPlaying]);

  if (!currentSong) return null;

  return (
    <div 
      ref={playerContainerRef}
      onContextMenu={handleContextMenu}
      className={cn(
        "fixed left-0 right-0 z-[70] transition-all duration-500",
        playerMode === 'video' ? "fullscreen-target inset-0 h-screen bg-black" : "bottom-[64px] pb-[env(safe-area-inset-bottom)] md:bottom-0 h-32 md:h-24 bg-black/90 backdrop-blur-2xl border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]",
        isUserInactive && playerMode === 'video' && "user-inactive"
      )}
    >
      {/* Queue Overlay */}
      <AnimatePresence>
        {showQueue && playerMode === 'audio' && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-24 right-6 w-80 max-h-[400px] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <h3 className="font-bold">Up Next</h3>
              <button onClick={() => setShowQueue(false)} className="text-zinc-400 hover:text-white">
                <Pause size={16} className="rotate-90" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {queue.map((song, i) => (
                <div 
                  key={`${song.id}-${i}`}
                  onClick={() => usePlayerStore.getState().setCurrentSong(song)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                    currentSong.id === song.id ? "bg-[#ff4e00]/10 text-[#ff4e00]" : "hover:bg-white/5"
                  )}
                >
                  <img src={getSongCoverUrl(song)} alt="" className="w-10 h-10 rounded object-cover" referrerPolicy="no-referrer" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    <p className="text-xs opacity-60 truncate">{song.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn(
        "flex flex-col md:flex-row items-center justify-between px-4 md:px-6 h-full transition-all duration-500 gap-2 md:gap-0",
        playerMode === 'video' ? "absolute bottom-0 left-0 right-0 h-auto md:h-24 bg-gradient-to-t from-black/95 via-black/80 to-transparent z-20" : ""
      )}>
        {/* Player Container - Hidden in audio mode, fullscreen in video mode */}
        <div className={cn(
          "transition-all duration-700 ease-in-out overflow-hidden pointer-events-none",
          playerMode === 'video' 
            ? "fixed inset-0 w-screen h-screen z-10 bg-black pointer-events-auto" 
            : "fixed -top-[2000px] -left-[2000px] w-[1px] h-[1px] opacity-0"
        )}>
          {playerMode === 'video' && (
            <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
              <button 
                onClick={() => setVideoZoom(1)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all backdrop-blur-md", videoZoom === 1 ? "bg-[#ff4e00] text-white" : "bg-black/60 text-white/60 hover:text-white")}
              >100%</button>
              <button 
                onClick={() => setVideoZoom(1.25)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all backdrop-blur-md", videoZoom === 1.25 ? "bg-[#ff4e00] text-white" : "bg-black/60 text-white/60 hover:text-white")}
              >125%</button>
              <button 
                onClick={() => setVideoZoom(1.5)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all backdrop-blur-md", videoZoom === 1.5 ? "bg-[#ff4e00] text-white" : "bg-black/60 text-white/60 hover:text-white")}
              >150%</button>
            </div>
          )}
          <div className={cn(
            "h-full w-full flex items-center justify-center transition-transform duration-500",
            playerType === 'youtube' ? 'block' : 'hidden'
          )}
          style={{ transform: `scale(${videoZoom})` }}>
            <YouTube 
              key={playerType} // Only re-mount if player type changes
              opts={ytOpts} 
              onReady={onPlayerReady} 
              onStateChange={onPlayerStateChange} 
              onError={onPlayerError}
              className="w-full h-full"
            />
          </div>
          <audio 
            ref={audioRef}
            className={playerType === 'audio' ? 'block' : 'hidden'}
            onLoadedMetadata={handleAudioMetadata}
            onPlaying={handleAudioPlaying}
            onEnded={handleAudioEnded}
            onError={handleAudioError}
            autoPlay={isPlaying}
            crossOrigin="anonymous"
          />
          <audio 
            ref={silentAnchorRef}
            src={SILENT_AUDIO}
            loop
            className="hidden"
          />
        </div>

        {/* Mobile Layout Override for Audio Mode */}
        {playerMode === 'audio' && (
          <div className="md:hidden w-full flex flex-col gap-2 py-2">
            {/* Seek Bar First */}
            <div className="flex items-center gap-3 w-full">
              <span className="text-[9px] text-zinc-500 font-mono w-8 text-right">{formatTime(progress)}</span>
              <div className="relative flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-[#ff4e00]" 
                  style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                />
                <input 
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={progress}
                  step="0.1"
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <span className="text-[9px] text-zinc-500 font-mono w-8">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <img 
                  src={getSongCoverUrl(currentSong)} 
                  alt={currentSong.title}
                  className="w-10 h-10 rounded shadow-lg object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="overflow-hidden">
                  <h4 className="font-semibold text-[11px] truncate">{currentSong.title}</h4>
                  <p className="text-[9px] text-zinc-400 truncate">{currentSong.artist}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 px-2">
                <button onClick={previous} className="text-zinc-400 active:text-white"><SkipBack size={20} fill="currentColor" /></button>
                <button 
                  onClick={handleTogglePlay}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black active:scale-90 transition-transform"
                >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                </button>
                <button onClick={next} className="text-zinc-400 active:text-white"><SkipForward size={20} fill="currentColor" /></button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={togglePlayerMode}
                  className="p-2 text-zinc-400"
                >
                  <Video size={18} />
                </button>
                <button 
                  onClick={() => setShowQueue(!showQueue)}
                  className={cn("p-2 transition-colors", showQueue ? "text-[#ff4e00]" : "text-zinc-400")}
                >
                  <ListMusic size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Layout or Video Mode Bottom Bar */}
        <div className={cn(
          "hidden md:flex flex-row items-center justify-between w-full h-full",
          playerMode === 'video' && "flex"
        )}>
          {/* Song Info */}
          <div className={cn(
            "flex items-center gap-4 transition-all duration-500 w-full md:w-1/3",
            playerMode === 'video' ? "md:w-1/4" : "md:w-1/3"
          )}>
            <motion.img 
              key={currentSong.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={getSongCoverUrl(currentSong)} 
              alt={currentSong.title}
              className="w-12 h-12 md:w-14 md:h-14 rounded-lg shadow-lg object-cover flex-shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="overflow-hidden flex-1">
              <h4 className="font-semibold text-xs md:text-sm hover:underline cursor-pointer truncate">{currentSong.title}</h4>
              <p className="text-[10px] md:text-xs text-zinc-400 hover:underline cursor-pointer truncate">{currentSong.artist}</p>
            </div>
          </div>

          {/* Controls */}
          <div className={cn(
            "flex flex-col items-center gap-2 transition-all duration-500 w-full md:w-1/3",
            playerMode === 'video' ? "md:w-2/4" : "md:w-1/3"
          )}>
            <div className="flex items-center gap-6 md:gap-8">
              <button className="hidden md:block text-zinc-400 hover:text-white transition-colors"><Shuffle size={18} /></button>
              <button onClick={previous} className="text-zinc-400 hover:text-white transition-colors"><SkipBack size={24} fill="currentColor" /></button>
              <button 
                onClick={handleTogglePlay}
                className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform active:scale-95 shadow-xl"
              >
                {isPlaying ? <Pause size={24} md:size={28} fill="currentColor" /> : <Play size={24} md:size={28} fill="currentColor" className="ml-1" />}
              </button>
              <button onClick={next} className="text-zinc-400 hover:text-white transition-colors"><SkipForward size={24} fill="currentColor" /></button>
              <button className="hidden md:block text-zinc-400 hover:text-white transition-colors"><Repeat size={18} /></button>
            </div>
            
            <div className="flex items-center gap-3 w-full max-w-md">
              <span className="text-[9px] md:text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(progress)}</span>
              <div className="relative flex-1 h-1.5 md:h-1 bg-white/10 rounded-full group cursor-pointer overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-[#ff4e00] group-hover:bg-[#ff6a2a]" 
                  style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                />
                <input 
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={progress}
                  step="0.1"
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <span className="text-[9px] md:text-[10px] text-zinc-500 font-mono w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume & Extra */}
          <div className={cn(
            "flex items-center justify-center md:justify-end gap-6 md:gap-4 transition-all duration-500 w-full md:w-1/3",
            playerMode === 'video' ? "md:w-1/4" : "md:w-1/3"
          )}>
            <div className="flex items-center gap-4">
              <button 
                onClick={togglePlayerMode}
                className={cn(
                  "p-2 rounded-full transition-all duration-300",
                  playerMode === 'video' ? "bg-[#ff4e00] text-white shadow-lg shadow-[#ff4e00]/20" : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                {playerMode === 'video' ? <Music size={20} /> : <Video size={20} />}
              </button>
              <button 
                onClick={() => setShowQueue(!showQueue)}
                className={cn("transition-colors", showQueue ? "text-[#ff4e00]" : "text-zinc-400 hover:text-white")}
              >
                <ListMusic size={20} />
              </button>
            </div>
            
            <div className="hidden md:flex items-center gap-2 w-32">
              <Volume2 size={20} className="text-zinc-400" />
              <div className="relative flex-1 h-1 bg-white/10 rounded-full group cursor-pointer overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-white group-hover:bg-[#ff4e00]" 
                  style={{ width: `${volume * 100}%` }}
                />
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
