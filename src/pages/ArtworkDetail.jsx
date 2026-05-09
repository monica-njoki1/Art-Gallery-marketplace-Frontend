import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ArtworkDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [art, setArt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://art-gallery-marketplace-backend.onrender.com/artworks/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch artwork");
        return res.json();
      })
      .then((data) => {
        setArt(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching artwork:", err);
        setLoading(false);
      });
  }, [id]);

  const handleAddToCart = () => {
    if (!user) {
      navigate("/login");
      return;
    }

    const userId = user.id || user.user_id || null;
    if (!userId) {
      console.warn("No user id available");
      navigate("/login");
      return;
    }

    fetch("https://art-gallery-marketplace-backend.onrender.com/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, artwork_id: art.id }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
        navigate(`/purchases?artworkId=${art.id}`);

      })
      .catch((err) => console.error("Error adding to cart:", err));
  };

  // ✅ Fix image handling (seeded vs uploaded vs missing)
  const getImageSrc = (url) => {
    if (!url) return "https://via.placeholder.com/600";
    return url.startsWith("http") ? url : `https://art-gallery-marketplace-backend.onrender.com${url}`;
  };

  if (loading) return <p className="text-center mt-10">Loading artwork...</p>;
  if (!art) return <p className="text-center mt-10">Artwork not found.</p>;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 animate-gradient bg-gradient-to-r from-black via-blue-300 to-gray-400 bg-[length:400%_400%]"></div>

      <div className="relative z-10 max-w-6xl mx-auto p-6 md:p-10">
        <div className="bg-transparent rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex flex-col md:flex-row items-start gap-6 bg-transparent">
            {/* Left: Image */}
            <div className="w-full md:w-1/2">
              <div className="rounded-xl overflow-hidden bg-gray-800/60">
                <img
                  src={getImageSrc(art.image_url)}
                  alt={art.title}
                  className="w-full h-80 md:h-[560px] object-cover transition-transform duration-500 hover:scale-105"
                  onError={(e) => (e.target.src = "https://via.placeholder.com/800")}
                />
              </div>
            </div>

            {/* Right: Details */}
            <div className="w-full md:w-1/2 bg-gray-800/85 backdrop-blur-md p-6 rounded-xl text-white">
              <h1 className="text-2xl md:text-3xl font-bold mb-3">{art.title}</h1>
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-semibold text-white">Artist:</span> {art.artist?.name || "Unknown Artist"}
              </p>
              <p className="text-xl text-blue-400 font-extrabold mb-4">${art.price}</p>

              {art.description && (
                <p className="text-gray-200 mb-4 leading-relaxed">
                  {art.description}
                </p>
              )}

              <p className="text-sm mb-4">
                Status: <span className={`font-semibold ${art.sold ? 'text-red-400' : 'text-green-300'}`}>{art.sold ? 'Sold' : 'Available'}</span>
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
                <button
                  onClick={() => navigate('/artworks')}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-medium border border-gray-600"
                >
                  ← Back
                </button>

                {!art.sold && (
                  user ? (
                    <button
                      onClick={handleAddToCart}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-md shadow-md"
                    >
                      Add to Cart
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/login')}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-md shadow-md"
                    >
                      Login to Purchase
                    </button>
                  )
                )}
              </div>

              {/* Logged-out note */}
              {!user && (
                <p className="text-gray-400 text-sm mt-4">Sign up or log in to add this artwork to your cart.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`\n        @keyframes gradientBG {\n          0% { background-position: 0% 50%; }\n          50% { background-position: 100% 50%; }\n          100% { background-position: 0% 50%; }\n        }\n        .animate-gradient {\n          animation: gradientBG 15s ease infinite;\n        }\n      `}</style>
    </div>
  );
}

export default ArtworkDetail;
