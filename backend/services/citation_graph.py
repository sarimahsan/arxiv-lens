import requests
import networkx as nx

SS_API = "https://api.semanticscholar.org/graph/v1"
HEADERS = {"User-Agent": "arxiv-research-tool/1.0"}


def build_citation_graph(arxiv_id: str) -> dict:
    try:
        lookup = requests.get(
            f"{SS_API}/paper/ARXIV:{arxiv_id}",
            params={"fields": "paperId,title,references"},
            headers=HEADERS,
            timeout=15
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

    for ref in references[:25]:
        ref_id = ref.get("paperId")
        ref_title = ref.get("title") or "Unknown"
        if ref_id:
            G.add_node(ref_id, title=ref_title, type="reference")
            G.add_edge(arxiv_id, ref_id)

    return nx.node_link_data(G)


def _empty_graph() -> dict:
    return {"nodes": [], "links": []}