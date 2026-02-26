(function () {
  function stripQuotes(value) {
    if (!value) return "";
    var out = String(value).trim();
    if (
      (out.startsWith("'") && out.endsWith("'")) ||
      (out.startsWith('"') && out.endsWith('"'))
    ) {
      out = out.slice(1, -1);
    }
    return out.trim();
  }

  function extractYear(value) {
    if (!value) return "";
    var match = String(value).match(/\b(\d{4})\b/);
    return match ? match[1] : "";
  }

  function parseCff(text) {
    var meta = {
      title: "",
      message: "",
      year: "",
      license: "",
      authors: [],
      identifiers: { doi: "", url: "" },
    };
    if (!text) return meta;

    var lines = text.split(/\r?\n/);
    var section = "";
    var currentAuthor = null;
    var currentIdentifier = null;

    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      var trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      var indent = (line.match(/^\s*/) || [""])[0].length;

      if (indent === 0) {
        currentAuthor = null;
        currentIdentifier = null;
        if (trimmed === "authors:") {
          section = "authors";
          continue;
        }
        if (trimmed === "identifiers:") {
          section = "identifiers";
          continue;
        }
        section = "";
        var topMatch = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (!topMatch) continue;
        var key = topMatch[1];
        var value = stripQuotes(topMatch[2]);
        if (key === "title") meta.title = value;
        if (key === "message") meta.message = value;
        if (key === "year" && value) meta.year = extractYear(value) || value;
        if (key === "date-released" && value && !meta.year) meta.year = extractYear(value) || value;
        if ((key === "license" || key === "licence") && value) meta.license = value;
        continue;
      }

      if (section === "authors") {
        var authorStart = trimmed.match(/^-+\s*family-names:\s*(.+)$/);
        if (authorStart) {
          currentAuthor = { family: stripQuotes(authorStart[1]), given: "", name: "" };
          meta.authors.push(currentAuthor);
          continue;
        }
        var authorStartByName = trimmed.match(/^-+\s*name:\s*(.+)$/);
        if (authorStartByName) {
          currentAuthor = { family: "", given: "", name: stripQuotes(authorStartByName[1]) };
          meta.authors.push(currentAuthor);
          continue;
        }
        if (trimmed.match(/^-+\s*$/)) {
          currentAuthor = { family: "", given: "", name: "" };
          meta.authors.push(currentAuthor);
          continue;
        }
        if (!currentAuthor) continue;
        var familyMatch = trimmed.match(/^family-names:\s*(.+)$/);
        if (familyMatch) {
          currentAuthor.family = stripQuotes(familyMatch[1]);
          continue;
        }
        var givenMatch = trimmed.match(/^given-names:\s*(.+)$/);
        if (givenMatch) {
          currentAuthor.given = stripQuotes(givenMatch[1]);
          continue;
        }
        var nameMatch = trimmed.match(/^name:\s*(.+)$/);
        if (nameMatch) {
          currentAuthor.name = stripQuotes(nameMatch[1]);
        }
        continue;
      }

      if (section === "identifiers") {
        var typeStart = trimmed.match(/^-+\s*type:\s*(.+)$/);
        if (typeStart) {
          currentIdentifier = { type: stripQuotes(typeStart[1]), value: "" };
          continue;
        }
        var valueStart = trimmed.match(/^-+\s*value:\s*(.+)$/);
        if (valueStart) {
          if (!currentIdentifier) currentIdentifier = { type: "", value: "" };
          currentIdentifier.value = stripQuotes(valueStart[1]);
        }
        var typeMatch = trimmed.match(/^type:\s*(.+)$/);
        if (typeMatch) {
          if (!currentIdentifier) currentIdentifier = { type: "", value: "" };
          currentIdentifier.type = stripQuotes(typeMatch[1]);
          continue;
        }
        var valueMatch = trimmed.match(/^value:\s*(.+)$/);
        if (valueMatch) {
          if (!currentIdentifier) currentIdentifier = { type: "", value: "" };
          currentIdentifier.value = stripQuotes(valueMatch[1]);
        }
        if (currentIdentifier && currentIdentifier.type && currentIdentifier.value) {
          var idType = currentIdentifier.type.toLowerCase();
          if (idType === "doi" && !meta.identifiers.doi) {
            meta.identifiers.doi = currentIdentifier.value;
          } else if (idType === "url" && !meta.identifiers.url) {
            meta.identifiers.url = currentIdentifier.value;
          }
        }
      }
    }

    return meta;
  }

  function splitPersonName(fullName) {
    var clean = String(fullName || "").replace(/\s+/g, " ").trim();
    if (!clean) return { family: "", given: "" };
    if (clean.indexOf(",") !== -1) {
      var byComma = clean.split(",");
      return { family: byComma[0].trim(), given: (byComma[1] || "").trim() };
    }
    var parts = clean.split(" ");
    if (parts.length === 1) return { family: parts[0], given: "" };
    return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(" ") };
  }

  function getPerson(author) {
    var family = (author && author.family ? String(author.family) : "").trim();
    var given = (author && author.given ? String(author.given) : "").trim();
    if (family || given) return { family: family, given: given };
    var name = (author && author.name ? String(author.name) : "").trim();
    if (!name) return { family: "", given: "" };
    return splitPersonName(name);
  }

  function getDisplayAuthor(author) {
    if (!author) return "";
    var full = (author.name || "").trim();
    if (full) return full;
    var person = getPerson(author);
    if (person.given && person.family) return person.given + " " + person.family;
    return person.family || person.given || "";
  }

  function isOrganizationAuthor(author) {
    if (!author) return false;
    var hasName = !!((author.name || "").trim());
    var hasPersonParts = !!((author.family || "").trim() || (author.given || "").trim());
    return hasName && !hasPersonParts;
  }

  function getCitationYear(meta) {
    if (meta.year && /^\d{4}$/.test(meta.year)) return meta.year;
    return "n.d.";
  }

  function toInitials(givenNames, withDots) {
    if (withDots === undefined) withDots = true;
    if (!givenNames) return "";
    return givenNames
      .split(/[\s-]+/)
      .filter(Boolean)
      .map(function (part) {
        return part.charAt(0).toUpperCase() + (withDots ? "." : "");
      })
      .join(" ");
  }

  function formatAuthorApa(author) {
    if (isOrganizationAuthor(author)) return getDisplayAuthor(author);
    var person = getPerson(author);
    var family = person.family;
    var initials = toInitials(person.given, true);
    if (family && initials) return family + ", " + initials;
    return family || initials || getDisplayAuthor(author);
  }

  function formatAuthorChicago(author, invert) {
    if (isOrganizationAuthor(author)) return getDisplayAuthor(author);
    var person = getPerson(author);
    var family = person.family;
    var given = person.given;
    if (invert) {
      if (family && given) return family + ", " + given;
      return family || given || getDisplayAuthor(author);
    }
    if (given && family) return given + " " + family;
    return family || given || getDisplayAuthor(author);
  }

  function formatAuthorMla(author, invert) {
    return formatAuthorChicago(author, invert);
  }

  function formatAuthorAsa(author) {
    if (isOrganizationAuthor(author)) return getDisplayAuthor(author);
    var person = getPerson(author);
    if (person.family && person.given) return person.family + ", " + person.given;
    return person.family || person.given || getDisplayAuthor(author);
  }

  function formatAuthorIeee(author) {
    if (isOrganizationAuthor(author)) return getDisplayAuthor(author);
    var person = getPerson(author);
    if (person.family && person.given) return toInitials(person.given, true) + " " + person.family;
    return person.family || person.given || getDisplayAuthor(author);
  }

  function formatAuthorVancouver(author) {
    if (isOrganizationAuthor(author)) return getDisplayAuthor(author);
    var person = getPerson(author);
    if (person.family && person.given) return person.family + " " + toInitials(person.given, false).replace(/\s+/g, "");
    return person.family || person.given || getDisplayAuthor(author);
  }

  function joinAuthors(authors, formatter, options) {
    if (!options) {
      options = { twoJoin: " & ", separator: ", ", lastJoin: ", & " };
    }
    var out = [];
    for (var i = 0; i < authors.length; i += 1) {
      var formatted = formatter(authors[i], i === 0);
      if (formatted) out.push(formatted);
    }
    if (out.length === 0) return "";
    if (out.length === 1) return out[0];
    if (out.length === 2) return out[0] + options.twoJoin + out[1];
    return out.slice(0, -1).join(options.separator) + options.lastJoin + out[out.length - 1];
  }

  function getMlaAuthorList(authors) {
    var out = [];
    for (var i = 0; i < authors.length; i += 1) {
      var formatted = formatAuthorMla(authors[i], i === 0);
      if (formatted) out.push(formatted);
    }
    if (out.length === 0) return "";
    if (out.length > 2) return out[0] + ", et al.";
    if (out.length === 2) return out[0] + ", and " + out[1];
    return out[0];
  }

  function getDoiUrl(meta) {
    if (meta.identifiers.doi) return "doi.org/" + meta.identifiers.doi;
    return meta.identifiers.url || "";
  }

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function buildBibtex(meta) {
    var title = meta.title || "Untitled dataset";
    var firstAuthor = meta.authors.length ? getDisplayAuthor(meta.authors[0]) : "";
    var keyBase = slugify(firstAuthor) || "citation";
    var key = keyBase + "_" + slugify(title).slice(0, 30);
    var authorText = meta.authors
      .map(function (a) {
        if (isOrganizationAuthor(a)) return getDisplayAuthor(a);
        var person = getPerson(a);
        if (person.family && person.given) return person.family + ", " + person.given;
        return person.family || person.given || getDisplayAuthor(a);
      })
      .filter(Boolean)
      .join(" and ");

    var lines = [];
    lines.push("@dataset{" + key + ",");
    lines.push("  title = {" + title + "},");
    if (authorText) lines.push("  author = {" + authorText + "},");
      if (meta.year && /^\d{4}$/.test(meta.year)) lines.push("  year = {" + meta.year + "},");
      if (meta.identifiers.doi) lines.push("  doi = {" + meta.identifiers.doi + "},");
      if (meta.identifiers.url) lines.push("  url = {" + meta.identifiers.url + "},");
      if (meta.license) lines.push("  license = {" + meta.license + "},");
      lines.push("  note = {Accessed " + getAccessedDateText() + "},");
      if (lines[lines.length - 1].endsWith(",")) {
        lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1);
      }
    lines.push("}");
    return lines.join("\n");
  }

  function buildApa(meta) {
    var authorText = joinAuthors(meta.authors, function (author) {
      return formatAuthorApa(author);
    });
    var year = getCitationYear(meta);
    var title = meta.title || "Untitled dataset";
    var url = getDoiUrl(meta);
    var lead = authorText || "Athens GIS Repository";
      var citation = lead + " (" + year + "). " + title + " [Dataset].";
      if (url) citation += " " + url;
      if (meta.license) citation += " License: " + meta.license + ".";
      return appendAccessed(citation);
  }

  function buildChicago(meta) {
    var authorText = joinAuthors(meta.authors, function (author, isFirst) {
      return formatAuthorChicago(author, isFirst);
    });
    var year = getCitationYear(meta);
    var title = meta.title || "Untitled dataset";
    var url = getDoiUrl(meta);
    var lead = authorText || "Athens GIS Repository";
      var citation = lead + '. "' + title + '." Dataset.';
      if (year !== "n.d.") citation += " " + year + ".";
      if (url) citation += " " + url;
      if (meta.license) citation += ". License: " + meta.license + ".";
      return appendAccessed(citation);
  }

  function buildMla(meta) {
    var authorText = getMlaAuthorList(meta.authors);
    var year = getCitationYear(meta);
    var title = meta.title || "Untitled dataset";
    var url = getDoiUrl(meta);
    var lead = authorText || "Athens GIS Repository";
      var citation = lead + '. "' + title + '."';
      citation += year !== "n.d." ? " " + year + "," : " n.d.,";
      if (url) citation += " " + url + ".";
      if (meta.license) citation += " License: " + meta.license + ".";
      return appendAccessed(citation);
  }

  function buildAsa(meta) {
    var authorText = joinAuthors(
      meta.authors,
      function (author) {
        return formatAuthorAsa(author);
      },
      { twoJoin: " and ", separator: ", ", lastJoin: ", and " }
    );
    var year = getCitationYear(meta);
    var title = meta.title || "Untitled dataset";
    var url = getDoiUrl(meta);
    var lead = authorText || "Athens GIS Repository";
      var citation = lead + ". " + year + '. "' + title + '." Dataset.';
      if (url) citation += " " + url + ".";
      if (meta.license) citation += " License: " + meta.license + ".";
      return appendAccessed(citation);
  }

  function buildIeee(meta) {
    var authorText = joinAuthors(
      meta.authors,
      function (author) {
        return formatAuthorIeee(author);
      },
      { twoJoin: " and ", separator: ", ", lastJoin: ", and " }
    );
    var year = getCitationYear(meta);
    var title = meta.title || "Untitled dataset";
    var url = getDoiUrl(meta);
    var lead = authorText || "Athens GIS Repository";
      var citation = lead + ', "' + title + '," dataset';
      if (year !== "n.d.") citation += ", " + year + ".";
      else citation += ".";
      if (url) citation += " [Online]. Available: " + url + ".";
      if (meta.license) citation += " License: " + meta.license + ".";
      return appendAccessed(citation);
  }

  function getAccessedDateText() {
    var now = new Date();
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return now.getDate() + " " + months[now.getMonth()] + " " + now.getFullYear();
  }

  function appendAccessed(citation) {
    var text = String(citation || "").trim();
    if (!text) return text;
    return text + " Accessed " + getAccessedDateText() + ".";
  }

  function buildVancouver(meta) {
    var authorText = joinAuthors(
      meta.authors,
      function (author) {
        return formatAuthorVancouver(author);
      },
      { twoJoin: ", ", separator: ", ", lastJoin: ", " }
    );
    var year = getCitationYear(meta);
    var title = meta.title || "Untitled dataset";
    var url = getDoiUrl(meta);
    var lead = authorText || "Athens GIS Repository";
      var citation = lead + ". " + title + " [dataset on the Internet].";
      citation += year !== "n.d." ? " " + year + "." : " [date unknown].";
      if (url) citation += " Available from: " + url + ".";
      if (meta.license) citation += " License: " + meta.license + ".";
      return appendAccessed(citation);
  }

  function buildCitation(meta, style) {
    if (style === "bibtex") return buildBibtex(meta);
    if (style === "chicago") return buildChicago(meta);
    if (style === "mla") return buildMla(meta);
    if (style === "asa") return buildAsa(meta);
    if (style === "ieee") return buildIeee(meta);
    if (style === "vancouver") return buildVancouver(meta);
    return buildApa(meta);
  }

  function copyText(text) {
    if (!text) return Promise.reject(new Error("No citation text available."));
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      try {
        var ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (ok) resolve();
        else reject(new Error("Copy command failed."));
      } catch (err) {
        document.body.removeChild(textarea);
        reject(err);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var openBtn = document.getElementById("citation-btn");
    var popup = document.getElementById("citation-popup");
    var closeBtn = document.getElementById("citation-close");
    var statusEl = document.getElementById("citation-status");
    var styleSelect = document.getElementById("citation-style");
    var textEl = document.getElementById("citation-text");
    var copyBtn = document.getElementById("citation-copy-btn");
    if (!openBtn || !popup || !closeBtn || !statusEl || !styleSelect || !textEl || !copyBtn) {
      return;
    }

    var parsedMeta = null;

    function setStatus(message, isError) {
      statusEl.textContent = message;
      statusEl.style.color = isError ? "#b91c1c" : "rgba(55, 65, 81, 0.9)";
    }

    function renderCitation() {
      if (!parsedMeta) {
        textEl.value = "";
        return;
      }
      textEl.value = buildCitation(parsedMeta, styleSelect.value);
    }

    function openPopup() {
      popup.hidden = false;
    }

    function closePopup() {
      popup.hidden = true;
    }

    openBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      if (popup.hidden) openPopup();
      else closePopup();
    });

    closeBtn.addEventListener("click", function () {
      closePopup();
    });

    styleSelect.addEventListener("change", function () {
      renderCitation();
      setStatus("Citation style updated.");
    });

    copyBtn.addEventListener("click", function () {
      renderCitation();
      var text = textEl.value;
      copyText(text)
        .then(function () {
          setStatus("Citation copied (" + styleSelect.value.toUpperCase() + ").");
        })
        .catch(function () {
          setStatus("Unable to copy citation. Select the text and copy manually.", true);
        });
    });

    popup.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    document.addEventListener("click", function (event) {
      if (popup.hidden) return;
      if (!popup.contains(event.target) && !openBtn.contains(event.target)) {
        closePopup();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closePopup();
    });

    fetch("CITATION.cff", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("CFF fetch failed");
        return response.text();
      })
      .then(function (cffText) {
        parsedMeta = parseCff(cffText);
        renderCitation();
        var loaded = [];
        if (parsedMeta.year) loaded.push("year " + parsedMeta.year);
        if (parsedMeta.license) loaded.push("license " + parsedMeta.license);
        if (loaded.length > 0) {
          setStatus("Select a style and use Copy. Loaded " + loaded.join(" and ") + ".");
        } else {
          setStatus("Select a style and use Copy.");
        }
      })
      .catch(function () {
        setStatus("Could not load CITATION.cff.", true);
        textEl.value = "";
      });
  });
})();
