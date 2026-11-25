(() => {
  "use strict";
  const tables = window.SAGE_RESULTS;
  const id = name => document.getElementById(name);
  if (!Array.isArray(tables) || !tables.length) {
    id("toggle-screen").hidden = true;
    id("view-title").textContent = "Benchmark results";
    id("view-panel").hidden = true;
    id("no-views").hidden = false;
    id("no-views").textContent = "Results could not be loaded. Check that the site’s assets folder contains results.js.";
    return;
  }

  const state = { table: tables[0], metric: 0, direction: "desc" };
  const numberFormat = new Intl.NumberFormat("en-US");
  const folded = value => String(value ?? "").toLowerCase().normalize("NFKC").replace(/[\s\-–_./]/g, "");
  const scopes = {public: "Public benchmarks", private: "Private benchmarks"};
  const node = (tag, value, className) => {
    const element = document.createElement(tag);
    if (value != null) element.textContent = value;
    if (className) element.className = className;
    return element;
  };
  function modelGroup(row) {
    return [row.family, row.scale].filter(Boolean).join(" · ");
  }
  function colLabel(column) {
    return [column.benchmark, column.metric].filter(Boolean).join(" · ");
  }
  function viewColumns(table) {
    const term = folded(id("bench-search").value);
    const tableMatch = folded([table.title, scopes[table.scope]].join(" ")).includes(term);
    return table.columns.map((column, index) => ({...column, index})).filter(column =>
      tableMatch || folded([column.benchmark, column.metric, column.category].join(" ")).includes(term));
  }
  function setView(table) {
    state.table = table;
    document.querySelector(".lb-spill").scrollTo(0, 0);
    const first = viewColumns(table)[0];
    state.metric = first?.index ?? 0;
    state.direction = first?.direction ?? "desc";
    const family = id("family-select").value;
    const select = id("family-select");
    const families = [...new Set(table.rows.map(row => row.family).filter(Boolean))];
    select.replaceChildren(new Option("All model families", ""), ...families.map(value => new Option(value, value)));
    if (families.includes(family)) select.value = family;
  }
  function updateIndex() {
    const groups = id("lb-index");
    const mobile = id("view-picker");
    groups.replaceChildren();
    mobile.replaceChildren();
    const available = tables.filter(table => viewColumns(table).length);
    id("view-panel").hidden = !available.length;
    id("no-views").hidden = !!available.length;
    mobile.disabled = !available.length;
    if (!available.length) {
      id("scope-tag").textContent = "";
      id("view-title").textContent = "No matching benchmarks";
      groups.append(node("p", "No matches", "lb-index-none"));
      return;
    }
    if (!available.includes(state.table)) setView(available[0]);
    Object.entries(scopes).forEach(([scope, title]) => {
      const views = available.filter(table => table.scope === scope);
      if (!views.length) return;
      const section = node("div", null, "lb-list-section");
      section.append(node("h3", title));
      const menu = document.createElement("optgroup");
      menu.label = title;
      for (const view of views) {
        const item = node("a", null, "lb-item");
        item.href = "#" + encodeURIComponent(view.id);
        item.append(node("span", view.title));
        if (view.id === state.table.id) item.setAttribute("aria-current", "true");
        item.addEventListener("click", event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          selectView(view);
        });
        section.append(item);
        menu.append(new Option(view.title, view.id));
      }
      groups.append(section);
      mobile.append(menu);
    });
    mobile.value = state.table.id;
  }
  function selectView(view) {
    setView(view);
    const hash = "#" + encodeURIComponent(view.id);
    if (location.hash !== hash) location.hash = hash;
    refresh();
    if (id("view-title").getBoundingClientRect().bottom < 0) {
      id("board").scrollIntoView({block: "start"});
    }
  }
  function fromLocation() {
    let selected = location.hash ? null : tables[0];
    if (location.hash) {
      try {
        selected = tables.find(table => table.id === decodeURIComponent(location.hash.slice(1)));
      } catch { return; }
    }
    if (selected && state.table !== selected) {
      if (!viewColumns(selected).length) id("bench-search").value = "";
      setView(selected);
    }
  }
  function getRanks(rows, metric, direction) {
    const sorted = [...rows].filter(row => row.values[metric] != null).sort((a,b) =>
      (Number(a.values[metric]) - Number(b.values[metric])) * (direction === "asc" ? 1 : -1)
    );
    const ranks = new Map();
    let previous;
    let rank;
    sorted.forEach((row, i) => {
      const value = Number(row.values[metric]);
      if (i === 0 || previous !== value) rank = i + 1;
      ranks.set(row, rank);
      previous = value;
    });
    return ranks;
  }
  function drawHead(columns) {
    const headers = node("tr");
    const fixed = node("th", state.metric >= 0 ? "Rank · Model / Size" : "Model / Size", "lb-sticky");
    fixed.scope = "col";
    headers.append(fixed);
    columns.forEach(column => {
      const current = state.metric === column.index;
      const th = node("th", null, current ? "lb-selected" : "");
      th.scope = "col";
      if (current) th.setAttribute("aria-sort", state.direction === "asc" ? "ascending" : "descending");
      const button = node("button");
      button.type = "button";
      button.title = "Sort by " + colLabel(column);
      const name = node("strong", column.benchmark);
      const detail = node("span", column.metric || "Score");
      const arrow = node("i", current ? (state.direction === "desc" ? "↓" : "↑") : "↕");
      arrow.setAttribute("aria-hidden", "true");
      detail.append(arrow);
      button.append(name, detail);
      button.addEventListener("click", () => {
        state.direction = current ? (state.direction === "desc" ? "asc" : "desc") : column.direction;
        state.metric = column.index;
        drawTable();
        id("cols").querySelector('[aria-sort] button')?.focus({preventScroll: true});
      });
      th.append(button);
      headers.append(th);
    });
    id("cols").replaceChildren(headers);
  }
  function drawTable() {
    const table = state.table;
    const columns = viewColumns(table);
    if (!columns.length) return;
    if (state.metric >= 0 && !columns.some(col => col.index === state.metric)) {
      state.metric = columns[0].index;
      state.direction = columns[0].direction;
    }
    const query = folded(id("model-search").value);
    const family = id("family-select").value;
    const rows = table.rows.filter(row => (!family || row.family === family) &&
      folded(row.model + " " + (row.size || "")).includes(query));
    const metric = state.metric;
    const ranked = metric >= 0;
    const ranks = ranked ? getRanks(table.rows, metric, table.columns[metric].direction) : null;
    if (ranked) rows.sort((a,b) => {
      const av = a.values[metric], bv = b.values[metric];
      if (av == null || bv == null) return Number(av == null) - Number(bv == null);
      return (Number(av) - Number(bv)) * (state.direction === "asc" ? 1 : -1);
    });
    id("scope-tag").textContent = scopes[table.scope];
    id("view-title").textContent = table.title;
    const rowCount = rows.length + (rows.length === 1 ? " model configuration" : " model configurations");
    const metricCount = columns.length + (columns.length === 1 ? " metric" : " metrics");
    id("row-summary").textContent = rowCount + " · " + metricCount;
    id("table-caption").textContent = table.title + ". " +
      (ranked ? "Sorted by " + colLabel(table.columns[metric]) + (state.direction === "asc" ? ", ascending." : ", descending.") : "Grouped by model family and size.");
    id("order-reset").disabled = !ranked;
    id("no-models").hidden = rows.length > 0;
    drawHead(columns);
    const fragment = document.createDocumentFragment();
    let lastGroup = null;
    rows.forEach(row => {
      if (!ranked && modelGroup(row) !== lastGroup) {
        lastGroup = modelGroup(row);
        const tr = node("tr", null, "lb-group");
        const cell = node("th", lastGroup);
        cell.colSpan = columns.length + 1;
        tr.append(cell);
        fragment.append(tr);
      }
      const tr = node("tr", null, /sage[ -]?med/i.test(row.model) ? "lb-ours" : "");
      const model = node("th", null, "lb-sticky");
      model.scope = "row";
      const line = node("div", null, "lb-model-cell");
      line.title = modelGroup(row);
      if (ranked) {
        const rank = ranks.get(row);
        const prefix = node("span", rank ?? "—", "lb-rank");
        prefix.setAttribute("aria-label", rank ? "Rank " + rank + " for this metric" : "Unranked");
        line.append(prefix);
      }
      const label = node("span", null, "lb-model-label");
      label.append(node("b", row.model), node("small", row.size || "Size unreported"));
      line.append(label);
      model.append(line);
      tr.append(model);
      for (const col of columns) {
        const val = row.values[col.index];
        const cell = node("td", val ?? "—");
        if (metric === col.index) cell.classList.add("lb-selected");
        if (val == null) cell.classList.add("lb-missing");
        if (row.marks[col.index] === 1) cell.classList.add("lb-best");
        if (row.marks[col.index] === 2) cell.classList.add("lb-second");
        tr.append(cell);
      }
      fragment.append(tr);
    });
    id("scores").replaceChildren(fragment);
  }
  function refresh() { updateIndex(); drawTable(); }
  const comparisonModels = new Set();
  for (const table of tables) {
    for (const row of table.rows) {
      if (row.model !== "Sage-Med-Preview") comparisonModels.add(JSON.stringify([row.model, row.size]));
    }
  }
  id("model-total").textContent = comparisonModels.size;
  id("score-total").textContent = numberFormat.format(tables.reduce((count, table) =>
    count + table.rows.reduce((n,row) => n + row.values.filter(val => val != null).length, 0), 0));
  id("view-picker").addEventListener("change", event => selectView(tables.find(table => table.id === event.target.value)));
  id("bench-search").addEventListener("input", refresh);
  id("model-search").addEventListener("input", drawTable);
  id("family-select").addEventListener("change", drawTable);
  id("order-reset").addEventListener("click", () => { state.metric = -1; drawTable(); });
  id("clear-models").addEventListener("click", () => {
    id("model-search").value = ""; id("family-select").value = ""; drawTable(); id("model-search").focus();
  });
  id("clear-bench").addEventListener("click", () => { id("bench-search").value = ""; refresh(); id("bench-search").focus(); });
  addEventListener("hashchange", () => { fromLocation(); refresh(); });
  const board = id("board");
  const screenToggle = id("toggle-screen");
  let expanded = false;
  let returnPosition;
  let obscured = [];

  function updateScreen(expand) {
    if (expanded === expand) return;
    expanded = expand;
    if (expand) {
      returnPosition = {x: window.scrollX, y: window.scrollY};
      obscured = Array.from(document.querySelectorAll(".lb-skip, .masthead, .lb-intro, .site-footer"))
        .filter(element => !element.inert);
      obscured.forEach(element => { element.inert = true; });
    } else {
      obscured.forEach(element => { element.inert = false; });
      obscured = [];
    }
    board.classList.toggle("is-expanded", expand);
    document.documentElement.classList.toggle("lb-screen-open", expand);
    screenToggle.setAttribute("aria-pressed", String(expand));
    id("screen-label").textContent = expand ? "Exit full screen" : "Full screen";
    screenToggle.focus({preventScroll:true});
    if (!expand) window.scrollTo({left:returnPosition.x, top:returnPosition.y, behavior:"instant"});
  }
  async function exitScreen() {
    if (document.fullscreenElement === board) {
      try { await document.exitFullscreen(); } catch { return; }
    }
    updateScreen(false);
  }
  screenToggle.addEventListener("click", async () => {
    if (expanded) {
      await exitScreen();
      return;
    }
    updateScreen(true);
    if (board.requestFullscreen && document.fullscreenEnabled) {
      try {
        await board.requestFullscreen();
        if (!expanded && document.fullscreenElement === board) await document.exitFullscreen();
      } catch {
        // The expanded layout also works when a browser blocks native fullscreen.
      }
    }
  });
  document.addEventListener("fullscreenchange", () => {
    if (expanded && document.fullscreenElement !== board) updateScreen(false);
  });
  document.addEventListener("keydown", event => {
    if (expanded && event.key === "Escape") {
      event.preventDefault();
      exitScreen();
    }
  });
  setView(tables[0]);
  fromLocation();
  refresh();
})();
