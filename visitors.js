(function () {
  const countEl = document.getElementById("visitor-count");
  if (!countEl) return;

  const endpoint =
    "https://njtp9nve1m.execute-api.us-east-1.amazonaws.com/prod/visitors";

  function setVisitorCount(visitors) {
    const n = Number(visitors);
    const label = Number.isFinite(n) ? String(n) : String(visitors);
    countEl.textContent = n === 1 ? "1 visitor" : `${label} visitors`;
  }

  async function trackVisit() {
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setVisitorCount(data.visitors);
    } catch {
      // Keep the placeholder if the request fails.
    }
  }

  trackVisit();
})();
