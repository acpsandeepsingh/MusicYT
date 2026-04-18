import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import Header from './components/Header';
import SongCard from './components/SongCard';
import Toast from './components/Toast';
import { Song, Playlist } from './types';
import { usePlayerStore } from './store/usePlayerStore';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Heart, Share2, MoreHorizontal, ChevronLeft, ListMusic } from 'lucide-react';
import { collection, onSnapshot, query, limit, doc, getDoc } from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import { getSongCoverUrl } from './lib/song-utils';

const GENRES = [
  { id: 'genre-new-songs', label: 'New Songs' },
  { id: 'genre-bollywood', label: 'Bollywood' },
  { id: 'genre-punjabi', label: 'Punjabi' },
  { id: 'genre-indi-pop', label: 'Indi Pop' },
  { id: 'genre-sufi', label: 'Sufi' },
  { id: 'genre-ghazal', label: 'Ghazal' },
  { id: 'genre-classical', label: 'Classical' },
];

export default function App() {
  const [genreData, setGenreData] = useState<Record<string, Song[]>>({});
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const { 
    setQueue, 
    setCurrentSong, 
    searchQuery, 
    activeView, 
    setActiveView, 
    selectedPlaylistId,
    favorites,
    sidebarCollapsed
  } = usePlayerStore();

  const isLiked = selectedPlaylistId === 'liked';
  const currentPlaylist = isLiked ? { name: 'Liked Songs' } : playlists.find(p => p.id === selectedPlaylistId);

  useEffect(() => {
    if (isLiked) {
      setPlaylistSongs(likedSongs);
    } else if (selectedPlaylistId) {
      const playlist = playlists.find(p => p.id === selectedPlaylistId);
      setPlaylistSongs(playlist?.songs || []);
    } else {
      setPlaylistSongs([]);
    }
  }, [selectedPlaylistId, isLiked, likedSongs, playlists]);

  useEffect(() => {
    if (likedSongs.length > 0) {
      const songIds = likedSongs.map(s => s.id);
      usePlayerStore.setState({ favorites: songIds });
    }
  }, [likedSongs]);

  useEffect(() => {
    if (!auth) return;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Fetch Liked Songs
        const likedQuery = query(collection(db, 'users', user.uid, 'liked-songs'));
        const unsubscribeLiked = onSnapshot(likedQuery, (snapshot) => {
          const songs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song));
          setLikedSongs(songs);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/liked-songs`);
        });

        // Fetch Playlists
        const playlistsQuery = query(collection(db, 'users', user.uid, 'playlists'));
        const unsubscribePlaylists = onSnapshot(playlistsQuery, (snapshot) => {
          const fetchedPlaylists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Playlist));
          setPlaylists(fetchedPlaylists);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/playlists`);
        });

        return () => {
          unsubscribeLiked();
          unsubscribePlaylists();
        };
      } else {
        setLikedSongs([]);
        setPlaylists([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const unsubscribes = GENRES.map((genre) => {
      // Try to fetch from api_cache collection where doc ID is the genre
      return onSnapshot(doc(db, 'api_cache', genre.id), async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          
          // Try different field names: 'songs', 'ids', 'songIds', 'data'
          const songsList = data.songs || data.ids || data.songIds || data.data;
          
          if (songsList && Array.isArray(songsList)) {
            // Check if the first item is a string (ID) or an object
            if (songsList.length > 0 && typeof songsList[0] === 'string') {
              // It's an array of IDs, fetch each song from 'songs' collection
              const songPromises = songsList.slice(0, 20).map(async (id: string) => {
                try {
                  const songDoc = await getDoc(doc(db, 'songs', id));
                  if (songDoc.exists()) {
                    const sData = songDoc.data();
                    const title = sData.title || sData.name || sData.songName || 'Unknown Title';
                    const artist = sData.artist || sData.singer || sData.artistName || 'Unknown Artist';
                    const audioUrl = sData.audioUrl || sData.url || sData.songUrl || '';
                    const videoId = sData.videoId || sData.youtubeId || (audioUrl.includes('youtube.com/watch?v=') ? audioUrl.split('v=')[1].split('&')[0] : audioUrl.includes('youtu.be/') ? audioUrl.split('be/')[1].split('?')[0] : '');
                    const youtubeId = videoId;
                    const thumbnailUrl = sData.thumbnailUrl || sData.thumbnail || sData.coverUrl;
                    const album = sData.album || '';
                    const genre = sData.genre || '';
                    const year = sData.year || 0;
                    const duration = sData.duration || 0;
                    const search_keywords = sData.search_keywords || [];
                    const title_keywords = sData.title_keywords || [];
                    const title_lowercase = sData.title_lowercase || title.toLowerCase();
                    
                    return { 
                      ...sData,
                      id: songDoc.id, 
                      title,
                      artist,
                      audioUrl,
                      youtubeId,
                      videoId,
                      thumbnailUrl,
                      album,
                      genre,
                      year,
                      duration,
                      search_keywords,
                      title_keywords,
                      title_lowercase
                    } as Song;
                  }
                } catch (err) {
                  console.error(`Error fetching song ${id}:`, err);
                }
                return null;
              });
              const songs = (await Promise.all(songPromises)).filter(s => s !== null) as Song[];
              setGenreData(prev => ({
                ...prev,
                [genre.id]: songs
              }));
            } else if (songsList.length > 0) {
              // It's an array of objects
              const mappedSongs = songsList.map((s: any) => {
                const title = s.title || s.name || s.songName || 'Unknown Title';
                const artist = s.artist || s.singer || s.artistName || 'Unknown Artist';
                const audioUrl = s.audioUrl || s.url || s.songUrl || '';
                const videoId = s.videoId || s.youtubeId || (audioUrl.includes('youtube.com/watch?v=') ? audioUrl.split('v=')[1].split('&')[0] : audioUrl.includes('youtu.be/') ? audioUrl.split('be/')[1].split('?')[0] : '');
                const youtubeId = videoId;
                const thumbnailUrl = s.thumbnailUrl || s.thumbnail || s.coverUrl;
                const album = s.album || '';
                const genre = s.genre || '';
                const year = s.year || 0;
                const duration = s.duration || 0;
                const search_keywords = s.search_keywords || [];
                const title_keywords = s.title_keywords || [];
                const title_lowercase = s.title_lowercase || title.toLowerCase();

                return {
                  ...s,
                  id: s.id || s.youtubeId || Math.random().toString(),
                  title,
                  artist,
                  audioUrl,
                  youtubeId,
                  videoId,
                  thumbnailUrl,
                  album,
                  genre,
                  year,
                  duration,
                  search_keywords,
                  title_keywords,
                  title_lowercase
                };
              });
              setGenreData(prev => ({
                ...prev,
                [genre.id]: mappedSongs
              }));
            }
          }
        } else {
          // Fallback to genre collection directly
          const q = query(collection(db, genre.id), limit(20));
          onSnapshot(q, (colSnapshot) => {
            if (colSnapshot.docs.length > 0) {
              const songs = colSnapshot.docs.map(doc => {
                const sData = doc.data();
                const title = sData.title || sData.name || sData.songName || 'Unknown Title';
                const artist = sData.artist || sData.singer || sData.artistName || 'Unknown Artist';
                const audioUrl = sData.audioUrl || sData.url || sData.songUrl || '';
                const videoId = sData.videoId || sData.youtubeId || (audioUrl.includes('youtube.com/watch?v=') ? audioUrl.split('v=')[1].split('&')[0] : audioUrl.includes('youtu.be/') ? audioUrl.split('be/')[1].split('?')[0] : '');
                const youtubeId = videoId;
                const thumbnailUrl = sData.thumbnailUrl || sData.thumbnail || sData.coverUrl;
                const album = sData.album || '';
                const genre = sData.genre || '';
                const year = sData.year || 0;
                const duration = sData.duration || 0;
                const search_keywords = sData.search_keywords || [];
                const title_keywords = sData.title_keywords || [];
                const title_lowercase = sData.title_lowercase || title.toLowerCase();

                return {
                  ...sData,
                  id: doc.id,
                  title,
                  artist,
                  audioUrl,
                  youtubeId,
                  videoId,
                  thumbnailUrl,
                  album,
                  genre,
                  year,
                  duration,
                  search_keywords,
                  title_keywords,
                  title_lowercase
                } as Song;
              });
              setGenreData(prev => ({
                ...prev,
                [genre.id]: songs
              }));
            }
          }, (error) => {
            handleFirestoreError(error, OperationType.LIST, genre.id);
          });
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `api_cache/${genre.id}`);
      });
    });

    setLoading(false);
    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  // Update global queue when data changes
  useEffect(() => {
    const allSongs = Object.values(genreData).flat() as Song[];
    if (allSongs.length > 0) {
      setQueue(allSongs);
    }
  }, [genreData, setQueue]);

  const allSongs = Array.from(new Map([...Object.values(genreData).flat(), ...likedSongs].map(s => [s.id, s])).values()) as Song[];
  
  const [youtubeResults, setYoutubeResults] = useState<Song[]>([]);

  useEffect(() => {
    if (searchQuery.trim().length > 2) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
          if (res.ok) {
            const data = await res.json();
            const items = data.items || [];
            const songs = items.map((item: any) => {
              const videoId = item.id?.videoId;
              if (!videoId) return null;
              return {
                id: videoId,
                title: item.snippet.title,
                artist: item.snippet.channelTitle,
                thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
                videoId: videoId,
                youtubeId: videoId,
                audioUrl: `/api/extract?id=${videoId}`,
                album: 'YouTube'
              } as Song;
            }).filter(Boolean) as Song[];
            setYoutubeResults(songs);
          }
        } catch (e) {
          console.error("Youtube search error:", e);
        }
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setYoutubeResults([]);
    }
  }, [searchQuery]);

  const searchResults = searchQuery.trim() ? allSongs.filter(s => {
    const query = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(query) ||
           s.artist.toLowerCase().includes(query) ||
           s.search_keywords?.some(k => k.toLowerCase().includes(query)) ||
           s.title_keywords?.some(k => k.toLowerCase().includes(query)) ||
           s.title_lowercase?.includes(query);
  }) : [];

  const featuredSong = allSongs[0];

  const displayedGenres = selectedGenre 
    ? GENRES.filter(g => g.id === selectedGenre)
    : GENRES;

  const renderContent = () => {
    if (searchQuery.trim() || activeView === 'search') {
      return (
        <section className="px-8 pt-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-black tracking-tighter">
                {searchQuery.trim() ? `Search Results for "${searchQuery}"` : 'Search'}
              </h2>
              {searchResults.length > 0 && (
                <button 
                  onClick={() => {
                    setQueue(searchResults);
                    setCurrentSong(searchResults[0]);
                  }}
                  className="w-10 h-10 bg-[#ff4e00] rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-transform"
                >
                  <Play size={20} fill="white" />
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <button 
                onClick={() => usePlayerStore.getState().setSearchQuery('')}
                className="text-sm font-semibold text-[#ff4e00] hover:underline"
              >
                Clear Search
              </button>
            )}
          </div>
          
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {searchResults.map(song => (
                <SongCard key={song.id} song={song} />
              ))}
            </div>
          ) : searchQuery.trim() && youtubeResults.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-zinc-400 text-lg">No useful content found for your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {GENRES.map(genre => (
                <div 
                  key={genre.id}
                  onClick={() => {
                    setSelectedGenre(genre.id);
                    setActiveView('home');
                  }}
                  className="h-32 bg-white/5 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-colors flex items-end"
                >
                  <h3 className="text-xl font-bold">{genre.label}</h3>
                </div>
              ))}
            </div>
          )}

          {searchQuery.trim() && youtubeResults.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-black tracking-tighter mb-6 flex items-center gap-2">
                YouTube Results
                <span className="text-xs font-medium px-2 py-0.5 bg-white/10 rounded-full text-zinc-400">Global</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-12">
                {youtubeResults.map(song => (
                  <SongCard key={song.id} song={song} />
                ))}
              </div>
            </div>
          )}
        </section>
      );
    }

    if (activeView === 'playlist') {
      return (
        <section className="px-8 pt-8">
          <div className="flex items-end gap-8 mb-8 flex-wrap">
            <div className={cn(
              "w-52 h-52 rounded-2xl shadow-2xl flex items-center justify-center relative group",
              isLiked ? "bg-gradient-to-br from-indigo-700 to-purple-900" : "bg-[#ff4e00]/20"
            )}>
              {isLiked ? <Heart size={80} fill="white" /> : <ListMusic size={80} className="text-[#ff4e00]" />}
              {playlistSongs.length > 0 && (
                <button 
                  onClick={() => {
                    setQueue(playlistSongs);
                    setCurrentSong(playlistSongs[0]);
                  }}
                  className="absolute bottom-4 right-4 w-12 h-12 bg-[#ff4e00] rounded-full flex items-center justify-center text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0"
                >
                  <Play size={24} fill="white" className="ml-1" />
                </button>
              )}
            </div>
            <div className="mb-2">
              <span className="text-xs font-bold uppercase tracking-widest">Playlist</span>
              <div className="flex items-center gap-4">
                <h2 className="text-5xl md:text-7xl font-black tracking-tighter mt-2 mb-4">{currentPlaylist?.name || 'Playlist'}</h2>
                {playlistSongs.length > 0 && (
                  <button 
                    onClick={() => {
                      setQueue(playlistSongs);
                      setCurrentSong(playlistSongs[0]);
                    }}
                    className="w-12 h-12 bg-[#ff4e00] rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-transform md:hidden"
                  >
                    <Play size={24} fill="white" className="ml-1" />
                  </button>
                )}
              </div>
              <p className="text-zinc-400 font-medium">{playlistSongs.length} songs</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {playlistSongs.map(song => (
              <SongCard key={song.id} song={song} />
            ))}
          </div>
          {!playlistLoading && playlistSongs.length === 0 && (
            <div className="text-center py-20">
              <p className="text-zinc-400 text-lg">This playlist is empty.</p>
              <button 
                onClick={() => setActiveView('home')}
                className="mt-4 text-[#ff4e00] hover:underline font-bold"
              >
                Discover music
              </button>
            </div>
          )}
        </section>
      );
    }

    if (activeView === 'library') {
      return (
        <section className="px-8 pt-8">
          <h2 className="text-3xl font-black tracking-tighter mb-8">Your Library</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            <div 
              onClick={() => setActiveView('playlist', 'liked')}
              className="bg-white/5 p-6 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer group"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-700 to-purple-900 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Heart size={32} fill="white" />
              </div>
              <h3 className="text-xl font-bold mb-1">Liked Songs</h3>
              <p className="text-zinc-400 text-sm">{likedSongs.length} songs</p>
            </div>

            {playlists.map(playlist => (
              <div 
                key={playlist.id}
                onClick={() => setActiveView('playlist', playlist.id)}
                className="bg-white/5 p-6 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <div className="w-16 h-16 bg-[#ff4e00]/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ListMusic size={32} className="text-[#ff4e00]" />
                </div>
                <h3 className="text-xl font-bold mb-1 truncate">{playlist.name}</h3>
                <p className="text-zinc-400 text-sm">Playlist</p>
              </div>
            ))}
          </div>
        </section>
      );
    }

    // Default Home View
    return (
      <>
        {selectedGenre && (
          <div className="px-8 pt-8">
            <button 
              onClick={() => setSelectedGenre(null)}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4"
            >
              <ChevronLeft size={20} />
              Back to Home
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!loading && featuredSong && !selectedGenre && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-8 py-6"
            >
              <div className="relative h-80 rounded-3xl overflow-hidden group">
                <img 
                  src={getSongCoverUrl(featuredSong, 'maxresdefault')} 
                  alt={featuredSong.title}
                  className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0502] via-transparent to-transparent" />
                
                <div className="relative h-full flex items-end p-10 gap-8">
                  <motion.img 
                    whileHover={{ scale: 1.05 }}
                    src={getSongCoverUrl(featuredSong)} 
                    alt={featuredSong.title}
                    className="w-52 h-52 rounded-2xl shadow-2xl object-cover border border-white/10"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 mb-2">
                    <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#ff4e00] mb-2 block">Featured Track</span>
                    <h2 className="text-6xl font-black tracking-tighter mb-4 line-clamp-1">{featuredSong.title}</h2>
                    <div className="flex items-center gap-4 text-zinc-300 mb-8">
                      <span className="font-semibold text-white">{featuredSong.artist}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-600" />
                      <span>{featuredSong.album || 'Single'}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setCurrentSong(featuredSong)}
                        className="px-8 py-3 bg-[#ff4e00] rounded-full font-bold flex items-center gap-2 hover:bg-[#ff6a2a] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#ff4e00]/20"
                      >
                        <Play size={20} fill="white" />
                        Play Now
                      </button>
                      <button 
                        onClick={() => usePlayerStore.getState().toggleFavorite(featuredSong.id)}
                        className={cn(
                          "p-3 rounded-full border transition-colors",
                          favorites.includes(featuredSong.id) 
                            ? "bg-[#ff4e00]/10 border-[#ff4e00] text-[#ff4e00]" 
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        )}
                      >
                        <Heart size={20} fill={favorites.includes(featuredSong.id) ? "currentColor" : "none"} />
                      </button>
                      <button className="p-3 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors">
                        <Share2 size={20} />
                      </button>
                      <button className="p-3 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors">
                        <MoreHorizontal size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {displayedGenres.map((genre) => {
          const songs = genreData[genre.id] || [];
          if (songs.length === 0 && !loading) return null;

          return (
            <section key={genre.id} className="px-8 py-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold tracking-tight">{genre.label}</h2>
                  {songs.length > 0 && (
                    <button 
                      onClick={() => {
                        setQueue(songs);
                        setCurrentSong(songs[0]);
                      }}
                      className="w-8 h-8 bg-[#ff4e00] rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-transform"
                    >
                      <Play size={16} fill="white" className="ml-0.5" />
                    </button>
                  )}
                </div>
                {!selectedGenre && (
                  <button 
                    onClick={() => setSelectedGenre(genre.id)}
                    className="text-sm font-semibold text-[#ff4e00] hover:underline"
                  >
                    Show all
                  </button>
                )}
              </div>
              
              <div className={selectedGenre ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" : "flex gap-6 overflow-x-auto pb-4 scrollbar-hide"}>
                {loading || songs.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="min-w-[200px] bg-white/5 p-4 rounded-xl animate-pulse">
                      <div className="aspect-square bg-white/10 rounded-lg mb-4" />
                      <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-white/10 rounded w-1/2" />
                    </div>
                  ))
                ) : (
                  (selectedGenre ? songs : songs.slice(0, 10)).map(song => (
                    <div key={song.id} className={selectedGenre ? "" : "min-w-[200px]"}>
                      <SongCard song={song} />
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0502] text-white">
      <div className="atmosphere" />
      
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Header />

        <div className="flex-1 overflow-y-auto pb-32 scroll-smooth">
          {renderContent()}
        </div>
      </main>

      <Player />
      <Toast />
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
