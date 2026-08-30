import numpy as np
from config import CLUSTER_K_MIN, CLUSTER_K_MAX


def cluster_embeddings(embeddings: list[list[float]]) -> list[int]:
    """Cluster chunk embeddings using K-Means. Returns cluster labels."""
    from sklearn.cluster import KMeans

    n = len(embeddings)
    if n <= CLUSTER_K_MIN:
        return list(range(n))  # Each chunk its own cluster

    k = min(CLUSTER_K_MAX, max(CLUSTER_K_MIN, n // 3))
    emb_array = np.array(embeddings, dtype=np.float32)

    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(emb_array)
    return labels.tolist()
