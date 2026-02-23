(function () {
  function stripAccents(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function norm(s) {
    return stripAccents(String(s || ""))
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function first3Upper(name) {
    const clean = stripAccents(String(name || ""))
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    return clean.slice(0, 3) || "???";
  }

  window.ICN_TEXT = { norm, first3Upper };
})();
