import { useEffect, useState } from "react";
import "./App.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const TMDB_GENRES = {
  28: "Action",
  12: "Aventure",
  16: "Animation",
  35: "Comédie",
  80: "Crime",
  99: "Documentaire",
  18: "Drame",
  10751: "Famille",
  14: "Fantastique",
  36: "Histoire",
  27: "Horreur",
  10402: "Musique",
  9648: "Mystère",
  10749: "Romance",
  878: "Science-fiction",
  10770: "Téléfilm",
  53: "Thriller",
  10752: "Guerre",
  37: "Western",
};

function pickRandomMovies(list, count = 5) {
  if (!Array.isArray(list) || list.length === 0) return [];

  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function groupMoviesByGenre(movies) {
  const groups = {};

  movies.forEach((movie) => {
    if (!movie.genre_ids || movie.genre_ids.length === 0) return;

    movie.genre_ids.forEach((genreId) => {
      const genreName = TMDB_GENRES[genreId];

      if (!genreName) return;

      if (!groups[genreName]) {
        groups[genreName] = [];
      }

      const alreadyExists = groups[genreName].some(
        (item) => item.tmdb_id === movie.tmdb_id
      );

      if (!alreadyExists) {
        groups[genreName].push(movie);
      }
    });
  });

  return groups;
}

function App() {
  const [movies, setMovies] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [featuredMovies, setFeaturedMovies] = useState([]);
  const [heroMovie, setHeroMovie] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [currentQuery, setCurrentQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState("home");


  const movieCategories = groupMoviesByGenre(movies);

  async function loadMovies(pageToLoad = 1, query = "") {
    try {
      setLoading(true);
      setError("");

      const url = query
        ? `${API_BASE}/movies/search?q=${encodeURIComponent(
            query
          )}&page=${pageToLoad}`
        : `${API_BASE}/movies?page=${pageToLoad}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des films");
      }

      const data = await response.json();
      const newMovies = data.results || [];

      if (pageToLoad === 1) {
  setMovies(newMovies);
  setSelectedMovie(newMovies[0] || null);

  const randomSelection = pickRandomMovies(newMovies, 5);
  setFeaturedMovies(randomSelection);
  setHeroMovie(randomSelection[0] || null);
} else {
  setMovies((oldMovies) => [...oldMovies, ...newMovies]);
}
    } catch (err) {
      setError("Impossible de charger les films depuis le backend.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadFavorites() {
    try {
      const response = await fetch(`${API_BASE}/favorites`);

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des favoris");
      }

      const data = await response.json();
      setFavorites(data.results || []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les favoris.");
    }
  }

  async function addToFavorites(movie) {
    try {
      setMessage("");
      setError("");

      const response = await fetch(`${API_BASE}/favorites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tmdb_id: movie.tmdb_id,
          title: movie.title,
          year: movie.year,
          description: movie.description,
          image_url: movie.image_url,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l’ajout aux favoris");
      }

      const data = await response.json();
      setMessage(data.message || "Film ajouté aux favoris");
      await loadFavorites();
    } catch (err) {
      setError("Impossible d’ajouter ce film aux favoris.");
      console.error(err);
    }
  }

  async function deleteFavorite(tmdbId) {
    try {
      setMessage("");
      setError("");

      const response = await fetch(`${API_BASE}/favorites/${tmdbId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la suppression du favori");
      }

      const data = await response.json();
      setMessage(data.message || "Film supprimé des favoris");
      await loadFavorites();
    } catch (err) {
      setError("Impossible de supprimer ce film des favoris.");
      console.error(err);
    }
  }

  function isFavorite(movie) {
    return favorites.some((favorite) => favorite.tmdb_id === movie.tmdb_id);
  }

  function handleSearch(e) {
    e.preventDefault();

    const query = search.trim();

    setCurrentQuery(query);
    setPage(1);
    setActivePage("home");
    loadMovies(1, query);
  }

  function handleLoadMore() {
    const nextPage = page + 1;

    setPage(nextPage);
    loadMovies(nextPage, currentQuery);
  }

  function shuffleFeaturedMovies() {
    const randomSelection = pickRandomMovies(movies, 5);

    setFeaturedMovies(randomSelection);
    setHeroMovie(randomSelection[0] || null);
  }

  function getCurrentHeroIndex() {
    return featuredMovies.findIndex(
      (movie) => movie.tmdb_id === heroMovie?.tmdb_id
    );
  }

  function showPrevHero() {
    if (featuredMovies.length === 0) return;

    const currentIndex = getCurrentHeroIndex();
    const prevIndex =
      currentIndex <= 0 ? featuredMovies.length - 1 : currentIndex - 1;

    setHeroMovie(featuredMovies[prevIndex]);
  }

  function showNextHero() {
    if (featuredMovies.length === 0) return;

    const currentIndex = getCurrentHeroIndex();
    const nextIndex =
      currentIndex === -1 || currentIndex >= featuredMovies.length - 1
        ? 0
        : currentIndex + 1;

    setHeroMovie(featuredMovies[nextIndex]);
  }

  useEffect(() => {
    loadMovies(1, "");
    loadFavorites();
  }, []);

  useEffect(() => {
    if (!message && !error) return;

    const timer = setTimeout(() => {
      setMessage("");
      setError("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [message, error]);
	
     const isSearchMode = currentQuery.trim().length > 0;
  return (
    <div className="app-shell">
      <header className="navbar">
        <div className="brand"
 		 onClick={() => {
 		   setActivePage("home");
 		   setSearch("");
  		   setCurrentQuery("");
    		   setPage(1);
  		   setMessage("");
   		   setError("");
  		   loadMovies(1, "");
  	}}>
          NACO
        </div>

        <nav className="nav-links">
          <button
            type="button"
            className={activePage === "home" ? "nav-link active" : "nav-link"}
            onClick={() => setActivePage("home")}
          >
            Home
          </button>

          <button
            type="button"
            className={
              activePage === "favorites" ? "nav-link active" : "nav-link"
            }
            onClick={() => {
              setActivePage("favorites");
              loadFavorites();
            }}
          >
            Favorites
          </button>
        </nav>

        <form className="nav-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search movie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button type="submit">Search</button>
        </form>
      </header>

      <main className="container">
        {message && <p className="message-box">{message}</p>}
        {error && <p className="error-box">{error}</p>}

        {activePage === "home" && (
          <>
            {heroMovie && (
              <section
                className="hero-banner"
                style={{
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.92)), url(${heroMovie.image_url})`,
                }}
              >
                <button
                  type="button"
                  className="hero-nav hero-nav-left"
                  onClick={showPrevHero}
                  aria-label="Film précédent"
                >
                  ‹
                </button>

                <button
                  type="button"
                  className="hero-nav hero-nav-right"
                  onClick={showNextHero}
                  aria-label="Film suivant"
                >
                  ›
                </button>

                <div className="hero-content">
                  <span className="hero-tag">Featured selection</span>

                  <h1>{heroMovie.title}</h1>

                  <p className="hero-year">{heroMovie.year}</p>

                  <p className="hero-description">
                    {heroMovie.description || "Aucune description disponible."}
                  </p>

                  <div className="hero-actions">
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => addToFavorites(heroMovie)}
                      disabled={isFavorite(heroMovie)}
                    >
                      {isFavorite(heroMovie)
                        ? "Déjà en favoris"
                        : "Ajouter aux favoris"}
                    </button>

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={shuffleFeaturedMovies}
                    >
                      Film aléatoire
                    </button>
                  </div>
                </div>

                <div className="hero-dots">
                  {featuredMovies.map((movie) => (
                    <button
                      key={movie.tmdb_id}
                      type="button"
                      className={
                        heroMovie?.tmdb_id === movie.tmdb_id
                          ? "hero-dot active"
                          : "hero-dot"
                      }
                      onClick={() => setHeroMovie(movie)}
                      aria-label={`Afficher ${movie.title}`}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="catalog-section">
  <div className="section-header">
    <h2>
      {isSearchMode
        ? `Résultats pour "${currentQuery}"`
        : "Trouvez votre prochain coup de cœur"}
    </h2>
  </div>

  {isSearchMode ? (
    <div className="movie-grid">
      {movies.length === 0 && !loading ? (
        <p>Aucun film trouvé.</p>
      ) : (
        movies.map((movie) => (
          <article className="movie-card" key={movie.tmdb_id}>
            <img
              className="movie-poster"
              src={movie.image_url}
              alt={movie.title}
            />

            <div className="movie-content">
              <h3>{movie.title}</h3>

              <p className="movie-meta">{movie.year}</p>

              <p className="movie-description">
                {movie.description || "Aucune description."}
              </p>

              <button
                type="button"
                className="card-btn"
                onClick={() => addToFavorites(movie)}
                disabled={isFavorite(movie)}
              >
                {isFavorite(movie)
                  ? "Déjà dans les favoris"
                  : "Ajouter aux favoris"}
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  ) : Object.keys(movieCategories).length === 0 && !loading ? (
    <div className="movie-grid">
      {movies.length === 0 ? (
        <p>Aucun film trouvé.</p>
      ) : (
        movies.map((movie) => (
          <article className="movie-card" key={movie.tmdb_id}>
            <img
              className="movie-poster"
              src={movie.image_url}
              alt={movie.title}
            />

            <div className="movie-content">
              <h3>{movie.title}</h3>

              <p className="movie-meta">{movie.year}</p>

              <p className="movie-description">
                {movie.description || "Aucune description."}
              </p>

              <button
                type="button"
                className="card-btn"
                onClick={() => addToFavorites(movie)}
                disabled={isFavorite(movie)}
              >
                {isFavorite(movie)
                  ? "Déjà dans les favoris"
                  : "Ajouter aux favoris"}
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  ) : (
    Object.entries(movieCategories).map(([categoryName, categoryMovies]) => (
      <section className="netflix-row" key={categoryName}>
        <h2 className="row-title">{categoryName}</h2>

        <div className="row-scroll">
          {categoryMovies.map((movie) => (
            <article
              className={
                selectedMovie?.tmdb_id === movie.tmdb_id
                  ? "netflix-card expanded"
                  : "netflix-card"
              }
              key={`${categoryName}-${movie.tmdb_id}`}
              onClick={() => setSelectedMovie(movie)}
            >
              <img
                className="netflix-poster"
                src={movie.image_url}
                alt={movie.title}
              />

              <div className="netflix-card-content">
                <h3>{movie.title}</h3>

                <div className="netflix-meta">
                  <span>{movie.year}</span>
                  <span>•</span>
                  <span>{categoryName}</span>
                </div>

                <p>{movie.description || "Aucune description disponible."}</p>

                <button
                  type="button"
                  className="card-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    addToFavorites(movie);
                  }}
                  disabled={isFavorite(movie)}
                >
                  {isFavorite(movie)
                    ? "Déjà dans les favoris"
                    : "Ajouter aux favoris"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    ))
  )}

  {loading && <p className="loading-text">Chargement des films...</p>}

  {!loading && movies.length > 0 && (
    <button
      id="loadMore"
      type="button"
      className="load-more-btn"
      onClick={handleLoadMore}
    >
      Charger plus
    </button>
  )}
</section>
          </>
        )}

        {activePage === "favorites" && (
          <section className="favorites-page">
            <div className="section-header">
              <h2>Mes favoris</h2>
            </div>

            {favorites.length === 0 ? (
              <p>Aucun favori pour le moment.</p>
            ) : (
              <div className="movie-grid">
                {favorites.map((favorite) => (
                  <article className="movie-card" key={favorite.tmdb_id}>
                    <img
                      className="movie-poster"
                      src={favorite.image_url}
                      alt={favorite.title}
                    />

                    <div className="movie-content">
                      <h3>{favorite.title}</h3>

                      <p className="movie-meta">{favorite.year}</p>

                      <p className="movie-description">
                        {favorite.description || "Aucune description."}
                      </p>

                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => deleteFavorite(favorite.tmdb_id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      
      <footer className="footer">
  	<div className="footer-container">
    		<p>© 2026 NACO — Tous droits réservés.</p>
  	</div>
      </footer>
      
      
      
    </div>
  );
}

export default App;
