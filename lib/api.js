// Client API centralisé - toutes les requêtes vers notre backend passent par ici

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function clearToken() {
  localStorage.removeItem('token');
}

async function request(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Une erreur est survenue.' }));
    throw new Error(error.error || 'Une erreur est survenue.');
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  signup: (data) => request('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  getCatalog: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/catalog${query ? `?${query}` : ''}`);
  },
  getContent: (id) => request(`/api/catalog/${id}`),

  getContinueWatching: (profileId) => request(`/api/watch/continue-watching/${profileId}`),
  updateProgress: (data) => request('/api/watch/progress', { method: 'POST', body: JSON.stringify(data) }),

  getMyList: (profileId) => request(`/api/watch/my-list/${profileId}`),
  addToMyList: (data) => request('/api/watch/my-list', { method: 'POST', body: JSON.stringify(data) }),
  removeFromMyList: (data) => request('/api/watch/my-list', { method: 'DELETE', body: JSON.stringify(data) }),

  createCheckoutSession: (priceId) =>
    request('/api/subscriptions/checkout', { method: 'POST', body: JSON.stringify({ priceId }) }),

  // --- Admin : gestion du catalogue ---
  getUploadUrl: (fileName, fileSize) =>
    request('/api/catalog/upload-url', { method: 'POST', body: JSON.stringify({ fileName, fileSize }) }),
  createMovie: (data) => request('/api/catalog/movies', { method: 'POST', body: JSON.stringify(data) }),
  createSeries: (data) => request('/api/catalog/series', { method: 'POST', body: JSON.stringify(data) }),
  createEpisode: (data) => request('/api/catalog/episodes', { method: 'POST', body: JSON.stringify(data) }),
};

/**
 * Upload du fichier vidéo vers NOTRE BACKEND, qui le retransmet ensuite à
 * Cloudflare Stream depuis le serveur. Cette approche évite complètement
 * les soucis de CORS que Cloudflare impose sur les uploads directs
 * depuis un navigateur.
 * onProgress reçoit un pourcentage (0-100).
 * Retourne le videoId Cloudflare une fois terminé.
 */
export function uploadVideoFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/catalog/upload`);

    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.videoId);
      } else {
        const error = JSON.parse(xhr.responseText || '{}');
        reject(new Error(error.error || "Échec de l'upload."));
      }
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload."));

    xhr.send(formData);
  });
}

export { getToken, setToken, clearToken };
