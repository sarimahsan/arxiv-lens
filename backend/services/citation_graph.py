import requests
import networkx as nx
import time

SS_API = "https://api.semanticscholar.org/graph/v1"

# Better headers that look like a real browser request
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
}

# Rate limiting configuration
MIN_REQUEST_DELAY = 3.0  # 3 seconds minimum between requests
last_request_time = 0
request_session = requests.Session()  # Reuse connection


def _rate_limit_wait():
    """Ensure minimum delay between API requests to avoid rate limiting."""
    global last_request_time
    elapsed = time.time() - last_request_time
    if elapsed < MIN_REQUEST_DELAY:
        time.sleep(MIN_REQUEST_DELAY - elapsed)
    last_request_time = time.time()


def _request_with_retry(url: str, max_retries: int = 5, backoff_factor: float = 3.0) -> requests.Response:
    """
    Make HTTP request with AGGRESSIVE exponential backoff retry for rate limiting (429) errors.
    
    Retry strategy:
    - Attempt 1: Wait 1s before request
    - If 429: Wait 5s before retry
    - If 429: Wait 15s before retry  
    - If 429: Wait 45s before retry
    - If 429: Wait 135s before retry
    - Give up and return empty graph
    """
    _rate_limit_wait()
    
    for attempt in range(max_retries):
        try:
            print(f"[graph] Attempt {attempt + 1}/{max_retries} to fetch {url.split('/')[-1][:30]}...")
            response = request_session.get(url, headers=HEADERS, timeout=20)
            
            # Success - return immediately
            if response.status_code == 200:
                print(f"[graph] ✓ Success!")
                return response
            
            # Rate limited - retry with MUCH longer waits
            if response.status_code == 429:
                # Exponential backoff: 5, 15, 45, 135 seconds
                wait_times = [5, 15, 45, 135]
                
                if attempt < max_retries - 1:
                    wait_time = wait_times[min(attempt, len(wait_times) - 1)]
                    print(f"[graph] ⚠ Rate limited (429). Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                    _rate_limit_wait()
                    continue
                else:
                    print(f"[graph] ✗ Rate limited after {max_retries} retries. Giving up.")
                    return response
            
            # Server error - retry
            if response.status_code >= 500:
                if attempt < max_retries - 1:
                    wait_time = 10 * (attempt + 1)
                    print(f"[graph] Server error ({response.status_code}). Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                    continue
            
            # Other errors - return as is
            print(f"[graph] Error {response.status_code}: {response.text[:100]}")
            return response
            
        except requests.exceptions.Timeout:
            print(f"[graph] ⏱ Timeout on attempt {attempt + 1}")
            if attempt < max_retries - 1:
                wait_time = 10 * (attempt + 1)
                print(f"[graph] Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
            else:
                raise
        except Exception as e:
            print(f"[graph] Exception: {e}")
            raise
    
    raise requests.exceptions.Timeout("Max retries exceeded")


def build_citation_graph(arxiv_id: str) -> dict:
    try:
        lookup = _request_with_retry(
            f"{SS_API}/paper/ARXIV:{arxiv_id}?fields=paperId,title,references"
        )
        
        if lookup.status_code != 200:
            print(f"[graph] S2 lookup failed: {lookup.status_code}")
            return _empty_graph()

        data = lookup.json()
        paper_title = data.get("title", arxiv_id)
        references = data.get("references", [])

    except requests.exceptions.Timeout:
        print("[graph] Semantic Scholar timed out — returning empty graph")
        return _empty_graph()
    except Exception as e:
        print(f"[graph] Error: {e}")
        return _empty_graph()

    G = nx.DiGraph()
    G.add_node(arxiv_id, title=paper_title, type="main")

    # Add reference nodes and edges
    edge_count = 0
    for ref in references[:25]:
        ref_id = ref.get("paperId")
        ref_title = ref.get("title") or "Unknown"
        if ref_id:
            G.add_node(ref_id, title=ref_title, type="reference")
            G.add_edge(arxiv_id, ref_id)
            edge_count += 1

    # Convert to node-link format (compatible with frontend)
    graph_dict = nx.node_link_data(G)
    
    # Ensure proper structure for frontend
    result = {
        "nodes": graph_dict.get("nodes", []),
        "links": graph_dict.get("links", [])
    }
    
    print(f"[graph] ✓ Built graph: {len(result['nodes'])} nodes, {len(result['links'])} links")
    
    return result


def _empty_graph() -> dict:
    return {"nodes": [], "links": []}