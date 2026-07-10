(function () {
  const btn = document.getElementById("visitor-btn");
  const countEl = document.getElementById("visitor-count");
  if (!btn || !countEl) return;

  const endpoint =
    "https://njtp9nve1m.execute-api.us-east-1.amazonaws.com/prod/visitors";
  const defaultLabel = btn.textContent;

  function setVisitorCount(visitors) {
    const n = Number(visitors);
    const label = Number.isFinite(n) ? String(n) : String(visitors);
    countEl.textContent = n === 1 ? "1 visitor" : `${label} visitors`;
    countEl.hidden = false;
  }

  btn.addEventListener("click", async () => {
    if (btn.disabled) return;

    btn.disabled = true;
    btn.textContent = "Sending…";

    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setVisitorCount(data.visitors);
      btn.textContent = "Thanks for visiting!";
    } catch {
      btn.textContent = "Something went wrong";
      btn.disabled = false;
      setTimeout(() => {
        btn.textContent = defaultLabel;
      }, 2000);
    }
  });
})();
