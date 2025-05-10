$(document).ready(function () {

  // ======================================
  // SPLASH SCREEN (Static Icons Underneath Text)
  // ======================================
  function createSplashIcons() {
    const iconPaths = [
      "./Icons/Fire.png",
      "./Icons/Ice.png",
      "./Icons/Storm.png",
      "./Icons/Myth.png",
      "./Icons/Life.png",
      "./Icons/Death.png",
      "./Icons/Balance.png",
      "./Icons/Shadow.png"
    ];
    iconPaths.forEach(function (iconSrc) {
      $('#splash-icons').append('<img src="' + iconSrc + '" alt="icon" />');
    });
  }
  createSplashIcons();

  // ======================================
  // INITIALIZE SELECT2 FIELDS
  // ======================================
  function initSelect2(selector) {
    $(selector).select2({
      placeholder: "Start typing to search...",
      allowClear: true,
      width: "100%"
    });
  }
  initSelect2(".gear-select, .pet-talent-select, .mount-select");

  // Initialize school dropdown (without search box)
  $("#school-select").select2({
    placeholder: "Select a School",
    allowClear: true,
    width: "100%",
    minimumResultsForSearch: Infinity
  });

  // ======================================
  // GLOBAL DATA & UTILITY FOR GEAR DROPDOWNS
  // ======================================
  const categoryDataCache = {};
  const rawURLs = {
    "Amulet":  "https://raw.githubusercontent.com/vrej-service/my-app-db/refs/heads/main/DB/Amulets/Amulets_Data/Amulets_Data.json",
    "Athames": "https://raw.githubusercontent.com/vrej-service/my-app-db/refs/heads/main/DB/Athames/Athames_Data/Athames_Data.json",
    "Boots":   "https://raw.githubusercontent.com/vrej-service/my-app-db/refs/heads/main/DB/Boots/Boots_Data/Boots_Data.json",
    "Decks":   "https://raw.githubusercontent.com/vrej-service/my-app-db/refs/heads/main/DB/Decks/Decks_Data/Decks_Data.json",
    "Hats":    "https://raw.githubusercontent.com/vrej-service/my-app-db/refs/heads/main/DB/Hats/Hats_Data/Hats_Data.json",
    "Jewels":  "https://raw.githubusercontent.com/vrej-service/my-app-db/refs/heads/main/DB/Jewels/Jewels_Data/Jewels_Data.json",
    "Rings":   "https://raw.githubusercontent.com/vrej-service/my-app-db/refs/heads/main/DB/Rings/Rings_Data/Rings_Data.json",
    "Robes":   "https://raw.githubusercontent.com/vrej-service/my-app-db/refs/heads/main/DB/Robes/Robes_Data/Robes_Data.json",
    "Wands":   "https://raw.githubusercontent.com/vrej-service/my-app-db/refs/heads/main/DB/Wands/Wands_Data/Wands_Data.json"
  };

  // Helper: Populate dropdown with gear items.
  function populateDropdown(selector, items) {
    console.log("Populating dropdown", selector, "with items:", items);
    $(selector).find("option:not(:first)").remove();
    items.forEach(function (item) {
      let displayText = item.displayName || item.Name;
      $(selector).append($("<option>", { value: item.Name, text: displayText }));
    });
  }

  function loadCategoryIndex(category, targetSelector) {
    const indexUrl = rawURLs[category];
    if (!indexUrl) {
      console.error("No URL found for category:", category);
      return $.Deferred().reject("No URL found for " + category).promise();
    }
    console.log("Loading index for", category, "from URL:", indexUrl);
    if (categoryDataCache[category]) {
      console.log("Using cached data for:", category);
      populateDropdown(targetSelector, categoryDataCache[category]);
      return $.Deferred().resolve().promise();
    }
    return $.getJSON(indexUrl)
      .done(function (data) {
        console.log("Data loaded for", category, ":", data);
        categoryDataCache[category] = data;
        populateDropdown(targetSelector, data);
      })
      .fail(function (jqxhr, textStatus, error) {
        console.error("Failed loading " + indexUrl + ": " + textStatus + " - " + error);
      });
  }

  // Mapping for gear dropdown selectors.
  const gearCategories = {
    "Hats": "#hat-select",
    "Robes": "#robe-select",
    "Boots": "#boots-select",
    "Wands": "#wand-select",
    "Decks": "#deck-select",
    "Athames": "#athame-select",
    "Amulet": "#amulet-select",
    "Rings": "#ring-select",
    "Jewels": ".jewel-select"
  };

  // ======================================
  // LEVEL FILTERING FUNCTIONS
  // ======================================
  function getLevelBracket(level) {
    let lvl = parseInt(level, 10);
    if (lvl >= 1 && lvl <= 29) return { min: 1, max: 29 };
    else if (lvl >= 30 && lvl <= 59) return { min: 30, max: 59 };
    else if (lvl >= 60 && lvl <= 99) return { min: 60, max: 99 };
    else if (lvl >= 100 && lvl <= 129) return { min: 100, max: 129 };
    else if (lvl >= 130 && lvl <= 159) return { min: 130, max: 159 };
    else if (lvl >= 160 && lvl <= 170) return { min: 160, max: 170 };
    else return null;
  }

  // ------------------------------------
  // BONUS EXTRACTION & SORTING FUNCTIONS
  // ------------------------------------
  
  // Simple helper to extract a bonus value after cleaning it
  function getBonusValue(item, bonusName) {
    if (!item.bonuses) return 0;
    for (let i = 0; i < item.bonuses.length; i++) {
      let bonusObj = item.bonuses[i];
      if (bonusObj.hasOwnProperty(bonusName)) {
        let bonusVal = bonusObj[bonusName];
        if (typeof bonusVal === 'object') {
          bonusVal = bonusVal[Object.keys(bonusVal)[0]];
        }
        bonusVal = bonusVal.replace(/[+\%,]/g, "").trim();
        let n = parseFloat(bonusVal);
        return isNaN(n) ? 0 : n;
      }
    }
    return 0;
  }

  // The sortItems function now implements:
  // For "damage": Primary: Damage (desc), Fallback 1: Critical Rating (desc), Fallback 2: Pierce (desc), then alphabetical.
  // For "resistance": Primary: Resistance (desc), Fallback 1: Health (desc), Fallback 2: Critical Block (desc), then alphabetical.
  function sortItems(items, sortType) {
    if (sortType === "name") {
      items.sort((a, b) => a.Name.localeCompare(b.Name));
    } else if (sortType === "damage") {
      items.sort((a, b) => {
        let damageA = getBonusValue(a, "Damage");
        let damageB = getBonusValue(b, "Damage");
        if (damageB !== damageA) return damageB - damageA;
        let critA = getBonusValue(a, "Critical");
        let critB = getBonusValue(b, "Critical");
        if (critB !== critA) return critB - critA;
        let pierceA = getBonusValue(a, "Pierce");
        let pierceB = getBonusValue(b, "Pierce");
        if (pierceB !== pierceA) return pierceB - pierceA;
        return a.Name.localeCompare(b.Name);
      });
    } else if (sortType === "resistance") {
      items.sort((a, b) => {
        let resistA = getBonusValue(a, "Resistance");
        let resistB = getBonusValue(b, "Resistance");
        if (resistB !== resistA) return resistB - resistA;
        let healthA = getBonusValue(a, "Health");
        let healthB = getBonusValue(b, "Health");
        if (healthB !== healthA) return healthB - healthA;
        let critBlockA = getBonusValue(a, "Critical Block");
        let critBlockB = getBonusValue(b, "Critical Block");
        if (critBlockB !== critBlockA) return critBlockB - critBlockA;
        return a.Name.localeCompare(b.Name);
      });
    }
  }

  // ------------------------------------
  // UPDATE GEAR DROPDOWNS (FILTER & SORT)
  // ------------------------------------
  function updateGearDropdowns() {
    let levelVal = $("#level-input").val();
    let levelBracket = levelVal ? getLevelBracket(levelVal) : null;
    let schoolVal = $("#school-select").val();
    let chosenSchool = schoolVal ? schoolVal.toLowerCase().trim() : null;
    let sortType = $("#sortby-select").val();

    $.each(gearCategories, function (category, selector) {
      if (categoryDataCache[category]) {
        let items = categoryDataCache[category];

        // Level filtering.
        if (levelBracket) {
          items = items.filter(function(item) {
            if (!item.level) return false;
            let levelStr = item.level.toLowerCase().trim();
            if (levelStr === "any level") return true;
            levelStr = levelStr.replace(/\+/, "");
            let gearLevel = parseInt(levelStr, 10);
            return gearLevel >= levelBracket.min && gearLevel <= levelBracket.max;
          });
        }

        // School filtering.
        if (chosenSchool) {
          items = items.filter(function(item) {
            if (typeof item["School Type"] !== "string") {
              console.log("Excluding item (School Type not a string):", item.Name);
              return false;
            }
            let schoolType = item["School Type"].toLowerCase().trim();
            console.log("Item:", item.Name, "School Type:", schoolType, "Chosen:", chosenSchool);
            if (schoolType === "any") {
              console.log("Including item because School Type is 'any':", item.Name);
              return true;
            }
            if (item["Wizards Cannot Use"]) {
              let cannotUseArr = item["Wizards Cannot Use"].toLowerCase().split(",").map(s => s.trim());
              if (cannotUseArr.indexOf(chosenSchool) !== -1) {
                console.log("Excluding item because 'Wizards Cannot Use' contains", chosenSchool, ":", item.Name);
                return false;
              }
            }
            let match = (schoolType === chosenSchool);
            if (!match) {
              console.log("Excluding item because School Type does not match chosen school:", item.Name);
            } else {
              console.log("Including item (School matches):", item.Name);
            }
            return match;
          });
        }
        
        // Sorting.
        sortItems(items, sortType);
        populateDropdown(selector, items);
      }
    });
  }

  $("#level-input").on("change", updateGearDropdowns);
  $("#school-select").on("change", updateGearDropdowns);
  $("#sortby-select").on("change", updateGearDropdowns);

  // ======================================
  // NEW JEWELS HANDLER
  // ======================================
  function computeTotalSockets() {
    let total = 0;
    $.each(gearCategories, function (category, selector) {
      if (category === "Jewels") return;
      let selectedVal = $(selector).val();
      if (selectedVal) {
        let gearList = categoryDataCache[category];
        if (gearList) {
          let gearItem = gearList.find(function (item) {
            return item.Name === selectedVal;
          });
          if (gearItem && gearItem.sockets) {
            total += parseInt(gearItem.sockets, 10);
          }
        }
      }
    });
    console.log("Computed total sockets:", total);
    return total;
  }

  $("#add-jewels-button").click(function () {
    let totalSockets = computeTotalSockets();
    if (totalSockets <= 0) {
      alert("No sockets available. Please choose gear with sockets first.");
      return;
    }
    $("#jewel-container").empty();
    for (let i = 0; i < totalSockets; i++) {
      let $dropdown = $(`
        <div class="field">
          <label>Jewel</label>
          <select class="gear-select jewel-select">
            <option value="" disabled selected>Select a Jewel</option>
          </select>
        </div>
      `);
      $("#jewel-container").append($dropdown);
      initSelect2($dropdown.find(".gear-select"));
      if (categoryDataCache["Jewels"]) {
        populateDropdown($dropdown.find(".jewel-select"), categoryDataCache["Jewels"]);
      } else {
        loadCategoryIndex("Jewels", $dropdown.find(".jewel-select"));
      }
    }
  });

  // ------------------------------------
  // PET TALENT SCHOOL DROPDOWN EXTENSION
  // ------------------------------------
  // Array of talent values that require an additional school dropdown.
  var talentsThatRequireSchool = [
    "damage",
    "resistance",
    "accuracy",
    "critical rating",
    "critical block rating",
    "armor piercing",
    "pip conversion"
  ];
  $(".pet-talent-select").on("change", function(){
      var selectedTalent = $.trim($(this).val().toLowerCase());
      // Remove any previously added school select for this pet field.
      $(this).siblings(".pet-school-select-wrapper").remove();
      
      if (talentsThatRequireSchool.indexOf(selectedTalent) !== -1) {
         var schoolSelect = $(`
           <select class="pet-school-select">
             <option value="" disabled selected>Choose School</option>
             <option value="fire">Fire</option>
             <option value="ice">Ice</option>
             <option value="storm">Storm</option>
             <option value="myth">Myth</option>
             <option value="life">Life</option>
             <option value="death">Death</option>
             <option value="balance">Balance</option>
             <option value="global">Global</option>
           </select>
         `);
         var wrapper = $('<div class="pet-school-select-wrapper"></div>');
         wrapper.append(schoolSelect);
         // Append the new dropdown below the current talent select.
         $(this).parent().append(wrapper);
         // Initialize this new select2 dropdown.
         schoolSelect.select2({ placeholder:"Choose School", allowClear:true, width:"100%"});
      }
  });

  // ------------------------------------
  // CALCULATE FINAL STATS FUNCTION (Extended to include Jewels and Pet Talents)
  // ------------------------------------
  function calculateFinalStats() {
    // Define aggregated variables for school-based stats.
    let aggregatedDamage = { "fire": 0, "ice": 0, "storm": 0, "myth": 0, "life": 0, "death": 0, "balance": 0, "shadow": 0 };
    let aggregatedFlatDamage = { "fire": 0, "ice": 0, "storm": 0, "myth": 0, "life": 0, "death": 0, "balance": 0, "shadow": 0 };
    let aggregatedResistance = { "fire": 0, "ice": 0, "storm": 0, "myth": 0, "life": 0, "death": 0, "balance": 0, "shadow": 0 };
    let aggregatedFlatResistance = { "fire": 0, "ice": 0, "storm": 0, "myth": 0, "life": 0, "death": 0, "balance": 0, "shadow": 0 };
    let aggregatedAccuracy = { "fire": 0, "ice": 0, "storm": 0, "myth": 0, "life": 0, "death": 0, "balance": 0, "shadow": 0 };
    let aggregatedCritical = { "fire": 0, "ice": 0, "storm": 0, "myth": 0, "life": 0, "death": 0, "balance": 0, "shadow": 0 };
    let aggregatedCriticalBlock = { "fire": 0, "ice": 0, "storm": 0, "myth": 0, "life": 0, "death": 0, "balance": 0, "shadow": 0 };
    let aggregatedArmorPiercing = { "fire": 0, "ice": 0, "storm": 0, "myth": 0, "life": 0, "death": 0, "balance": 0, "shadow": 0 };
    let aggregatedPipConversion = { "fire": 0, "ice": 0, "storm": 0, "myth": 0, "life": 0, "death": 0, "balance": 0, "shadow": 0 };

    // Define aggregated variables for non-school bonuses.
    let aggregatedStunResistance = 0;
    let aggregatedIncomingHealing = 0;
    let aggregatedOutgoingHealing = 0;
    let aggregatedPowerPip = 0;
    let aggregatedShadowPip = 0;
    let aggregatedArchmastery = 0;

    // Define aggregated variables for Vitals.
    let aggregatedHealth = 0;
    let aggregatedMana = 0;
    let aggregatedEnergy = 0;

    // Helper: Process bonuses from a given item.
    function processBonuses(item) {
      if (item && item.bonuses) {
        item.bonuses.forEach(function (bonusObj) {
          for (let bonusKey in bonusObj) {
            let bonusVal = bonusObj[bonusKey];
            // School-based bonuses:
            if (bonusKey === "Damage") {
              if (typeof bonusVal === "object") {
                for (let school in bonusVal) {
                  let rawValue = bonusVal[school];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) {
                    if (school.toLowerCase() === "global") {
                      for (let key in aggregatedDamage) {
                        aggregatedDamage[key] += num;
                      }
                    } else {
                      let key = school.toLowerCase();
                      if (aggregatedDamage.hasOwnProperty(key)) {
                        aggregatedDamage[key] += num;
                      }
                    }
                  }
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) {
                  for (let key in aggregatedDamage) {
                    aggregatedDamage[key] += num;
                  }
                }
              }
            } else if (bonusKey === "Flat Damage") {
              if (typeof bonusVal === "object") {
                for (let school in bonusVal) {
                  let rawValue = bonusVal[school];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) {
                    if (school.toLowerCase() === "global") {
                      for (let key in aggregatedFlatDamage) {
                        aggregatedFlatDamage[key] += num;
                      }
                    } else {
                      let key = school.toLowerCase();
                      if (aggregatedFlatDamage.hasOwnProperty(key)) {
                        aggregatedFlatDamage[key] += num;
                      }
                    }
                  }
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) {
                  for (let key in aggregatedFlatDamage) {
                    aggregatedFlatDamage[key] += num;
                  }
                }
              }
            } else if (bonusKey === "Resistance") {
              if (typeof bonusVal === "object") {
                for (let school in bonusVal) {
                  let rawValue = bonusVal[school];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) {
                    if (school.toLowerCase() === "global") {
                      for (let key in aggregatedResistance) {
                        aggregatedResistance[key] += num;
                      }
                    } else {
                      let key = school.toLowerCase();
                      if (aggregatedResistance.hasOwnProperty(key)) {
                        aggregatedResistance[key] += num;
                      }
                    }
                  }
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) {
                  for (let key in aggregatedResistance) {
                    aggregatedResistance[key] += num;
                  }
                }
              }
            } else if (bonusKey === "Flat Resistance") {
              if (typeof bonusVal === "object") {
                for (let school in bonusVal) {
                  let rawValue = bonusVal[school];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) {
                    if (school.toLowerCase() === "global") {
                      for (let key in aggregatedFlatResistance) {
                        aggregatedFlatResistance[key] += num;
                      }
                    } else {
                      let key = school.toLowerCase();
                      if (aggregatedFlatResistance.hasOwnProperty(key)) {
                        aggregatedFlatResistance[key] += num;
                      }
                    }
                  }
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) {
                  for (let key in aggregatedFlatResistance) {
                    aggregatedFlatResistance[key] += num;
                  }
                }
              }
            } else if (bonusKey === "Accuracy") {
              if (typeof bonusVal === "object") {
                for (let school in bonusVal) {
                  let rawValue = bonusVal[school];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) {
                    if (school.toLowerCase() === "global") {
                      for (let key in aggregatedAccuracy) {
                        aggregatedAccuracy[key] += num;
                      }
                    } else {
                      let key = school.toLowerCase();
                      if (aggregatedAccuracy.hasOwnProperty(key)) {
                        aggregatedAccuracy[key] += num;
                      }
                    }
                  }
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) {
                  for (let key in aggregatedAccuracy) {
                    aggregatedAccuracy[key] += num;
                  }
                }
              }
            } else if (bonusKey === "Critical") {
              if (typeof bonusVal === "object") {
                for (let school in bonusVal) {
                  let rawValue = bonusVal[school];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) {
                    if (school.toLowerCase() === "global") {
                      for (let key in aggregatedCritical) {
                        aggregatedCritical[key] += num;
                      }
                    } else {
                      let key = school.toLowerCase();
                      if (aggregatedCritical.hasOwnProperty(key)) {
                        aggregatedCritical[key] += num;
                      }
                    }
                  }
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) {
                  for (let key in aggregatedCritical) {
                    aggregatedCritical[key] += num;
                  }
                }
              }
            } else if (bonusKey === "Critical Block") {
              if (typeof bonusVal === "object") {
                for (let school in bonusVal) {
                  let rawValue = bonusVal[school];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) {
                    if (school.toLowerCase() === "global") {
                      for (let key in aggregatedCriticalBlock) {
                        aggregatedCriticalBlock[key] += num;
                      }
                    } else {
                      let key = school.toLowerCase();
                      if (aggregatedCriticalBlock.hasOwnProperty(key)) {
                        aggregatedCriticalBlock[key] += num;
                      }
                    }
                  }
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) {
                  for (let key in aggregatedCriticalBlock) {
                    aggregatedCriticalBlock[key] += num;
                  }
                }
              }
            } else if (bonusKey === "Armor Piercing") {
              if (typeof bonusVal === "object") {
                for (let school in bonusVal) {
                  let rawValue = bonusVal[school];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) {
                    if (school.toLowerCase() === "global") {
                      for (let key in aggregatedArmorPiercing) {
                        aggregatedArmorPiercing[key] += num;
                      }
                    } else {
                      let key = school.toLowerCase();
                      if (aggregatedArmorPiercing.hasOwnProperty(key)) {
                        aggregatedArmorPiercing[key] += num;
                      }
                    }
                  }
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) {
                  for (let key in aggregatedArmorPiercing) {
                    aggregatedArmorPiercing[key] += num;
                  }
                }
              }
            } else if (bonusKey === "Pip Conversion") {
              if (typeof bonusVal === "object") {
                for (let school in bonusVal) {
                  let rawValue = bonusVal[school];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) {
                    if (school.toLowerCase() === "global") {
                      for (let key in aggregatedPipConversion) {
                        aggregatedPipConversion[key] += num;
                      }
                    } else {
                      let key = school.toLowerCase();
                      if (aggregatedPipConversion.hasOwnProperty(key)) {
                        aggregatedPipConversion[key] += num;
                      }
                    }
                  }
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) {
                  for (let key in aggregatedPipConversion) {
                    aggregatedPipConversion[key] += num;
                  }
                }
              }
            }
            // Other Stats (non-school bonuses)
            else if (bonusKey === "Stun Resistance") {
              if (typeof bonusVal === "object") {
                for (let k in bonusVal) {
                  let rawValue = bonusVal[k];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) aggregatedStunResistance += num;
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) aggregatedStunResistance += num;
              }
            } else if (bonusKey === "Healing") {
              if (typeof bonusVal === "object") {
                for (let subKey in bonusVal) {
                  let rawValue = bonusVal[subKey];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) {
                    if (subKey.toLowerCase() === "incoming") {
                      aggregatedIncomingHealing += num;
                    } else if (subKey.toLowerCase() === "outgoing") {
                      aggregatedOutgoingHealing += num;
                    }
                  }
                }
              }
            } else if (bonusKey === "Power Pip") {
              if (typeof bonusVal === "object") {
                for (let k in bonusVal) {
                  let rawValue = bonusVal[k];
                  let num = parseFloat(rawValue.replace(/[+\%,\sA-Za-z]/g, ""));
                  if (!isNaN(num)) aggregatedPowerPip += num;
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,\sA-Za-z]/g, ""));
                if (!isNaN(num)) aggregatedPowerPip += num;
              }
            } else if (bonusKey === "Shadow Pip") {
              if (typeof bonusVal === "object") {
                for (let k in bonusVal) {
                  let rawValue = bonusVal[k];
                  let num = parseFloat(rawValue.replace(/[+\%,\sA-Za-z]/g, ""));
                  if (!isNaN(num)) aggregatedShadowPip += num;
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,\sA-Za-z]/g, ""));
                if (!isNaN(num)) aggregatedShadowPip += num;
              }
            } else if (bonusKey === "Archmastery") {
              if (typeof bonusVal === "object") {
                for (let k in bonusVal) {
                  let rawValue = bonusVal[k];
                  let num = parseFloat(rawValue.replace(/[+\%,\sA-Za-z]/g, ""));
                  if (!isNaN(num)) aggregatedArchmastery += num;
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,\sA-Za-z]/g, ""));
                if (!isNaN(num)) aggregatedArchmastery += num;
              }
            }
            // Vitals bonuses:
            else if (bonusKey === "Health") {
              if (typeof bonusVal === "object") {
                for (let k in bonusVal) {
                  let rawValue = bonusVal[k];
                  let num = parseFloat(rawValue.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) aggregatedHealth += num;
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) aggregatedHealth += num;
              }
            } else if (bonusKey === "Mana") {
              if (typeof bonusVal === "object") {
                for (let k in bonusVal) {
                  let rawValue = bonusVal[k];
                  let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) aggregatedMana += num;
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) aggregatedMana += num;
              }
            } else if (bonusKey === "Energy") {
              if (typeof bonusVal === "object") {
                for (let k in bonusVal) {
                  let rawValue = bonusVal[k];
                  let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                  if (!isNaN(num)) aggregatedEnergy += num;
                }
              } else {
                let num = parseFloat(bonusVal.replace(/[+\%,]/g, ""));
                if (!isNaN(num)) aggregatedEnergy += num;
              }
            }
          }
        });
      }
    }

    // Process non-jewel gear.
    $.each(gearCategories, function (category, selector) {
      if (category === "Jewels") return;
      let selectedName = $(selector).val();
      if (selectedName) {
        let gearList = categoryDataCache[category];
        if (gearList) {
          let gearItem = gearList.find(item => item.Name === selectedName);
          processBonuses(gearItem);
        }
      }
    });

    // Process jewels.
    $(".jewel-select").each(function () {
      let selectedName = $(this).val();
      if (selectedName) {
        let jewelList = categoryDataCache["Jewels"];
        if (jewelList) {
          let jewelItem = jewelList.find(item => item.Name === selectedName);
          processBonuses(jewelItem);
        }
      }
    });

    // --- Process Pet Talents ---
    // Loop through each pet talent slot (assumes 5 slots; adjust as necessary)
    for (let i = 1; i <= 5; i++) {
      // Get the pet talent type value and input value.
      let talentType = $("#pet-talent" + i + "-type").val();
      let talentValue = parseFloat($("#pet-talent" + i).val());
      if (!talentType || isNaN(talentValue)) continue; // Skip if no talent selected or input is invalid

      // Normalize the talent type.
      talentType = talentType.toLowerCase().trim();

      // Look for an appended school dropdown.
      let schoolSelect = $("#pet-talent" + i + "-type").siblings(".pet-school-select-wrapper").find(".pet-school-select");
      let school = schoolSelect.length ? schoolSelect.val() : null;  // e.g., 'fire', 'ice', etc.

      // Helper: Add bonus to a school-based aggregated object.
      function addToAggregated(aggregatedObj) {
        if (school && school !== "" && school !== "global") {
          aggregatedObj[school] += talentValue;
        } else {
          // If no school is specified or "global" is chosen, add to all schools.
          for (let key in aggregatedObj) {
            aggregatedObj[key] += talentValue;
          }
        }
      }

      // Process based on talent type.
      switch (talentType) {
        // School-specific talent types:
        case "damage":
          addToAggregated(aggregatedDamage);
          break;
        case "resistance":
          addToAggregated(aggregatedResistance);
          break;
        case "accuracy":
          addToAggregated(aggregatedAccuracy);
          break;
        case "critical rating":
          addToAggregated(aggregatedCritical);
          break;
        case "critical block rating":
          addToAggregated(aggregatedCriticalBlock);
          break;
        case "armor piercing":
          addToAggregated(aggregatedArmorPiercing);
          break;
        case "pip conversion":
          addToAggregated(aggregatedPipConversion);
          break;
          
        // Non-school-based talent types:
        case "stun resistance":
          aggregatedStunResistance += talentValue;
          break;
        case "incoming healing":
          aggregatedIncomingHealing += talentValue;
          break;
        case "outgoing healing":
          aggregatedOutgoingHealing += talentValue;
          break;
        case "power pips":
          aggregatedPowerPip += talentValue;
          break;
        case "shadow pip bonus":
          aggregatedShadowPip += talentValue;
          break;
        case "archmastery":
          aggregatedArchmastery += talentValue;
          break;
        case "health":
          aggregatedHealth += talentValue;
          break;
        case "mana":
          aggregatedMana += talentValue;
          break;
        case "energy":
          aggregatedEnergy += talentValue;
          break;
        default:
          console.warn("Unrecognized pet talent type:", talentType);
      }
    }

    // Log aggregated values for debugging.
    console.log("Aggregated Damage (percent):", aggregatedDamage);
    console.log("Aggregated Flat Damage:", aggregatedFlatDamage);
    console.log("Aggregated Resistance (percent):", aggregatedResistance);
    console.log("Aggregated Flat Resistance:", aggregatedFlatResistance);
    console.log("Aggregated Accuracy (percent):", aggregatedAccuracy);
    console.log("Aggregated Critical (percent):", aggregatedCritical);
    console.log("Aggregated Critical Block (percent):", aggregatedCriticalBlock);
    console.log("Aggregated Armor Piercing (percent):", aggregatedArmorPiercing);
    console.log("Aggregated Pip Conversion:", aggregatedPipConversion);
    console.log("Aggregated Stun Resistance:", aggregatedStunResistance);
    console.log("Aggregated Incoming Healing:", aggregatedIncomingHealing);
    console.log("Aggregated Outgoing Healing:", aggregatedOutgoingHealing);
    console.log("Aggregated Power Pip:", aggregatedPowerPip);
    console.log("Aggregated Shadow Pip:", aggregatedShadowPip);
    console.log("Aggregated Archmastery:", aggregatedArchmastery);
    console.log("Aggregated Health:", aggregatedHealth);
    console.log("Aggregated Mana:", aggregatedMana);
    console.log("Aggregated Energy:", aggregatedEnergy);

    // ------------------ Update Final Stats on the Page ------------------
    // Define school order.
    const schools = ["fire", "ice", "storm", "myth", "life", "death", "balance", "shadow"];
    
    // Update Damage section (first final-stats-line).
    let damageGrid = $("#final-stats").find(".final-stats-line").first().find(".composite-grid");
    damageGrid.children().each(function(index) {
      if (index < schools.length) {
        let school = schools[index];
        $(this).find(".middle-floor .stat-value").text(aggregatedDamage[school] || 0);
        $(this).find(".bottom-floor .stat-value").text(aggregatedFlatDamage[school] || 0);
      }
    });
    
    // Update Resistance section (second final-stats-line).
    let resistanceGrid = $("#final-stats").find(".final-stats-line").eq(1).find(".composite-grid");
    resistanceGrid.children().each(function(index) {
      if (index < schools.length) {
        let school = schools[index];
        $(this).find(".middle-floor .stat-value").text(aggregatedResistance[school] || 0);
        $(this).find(".bottom-floor .stat-value").text(aggregatedFlatResistance[school] || 0);
      }
    });
    
    // Update Accuracy section (third final-stats-line).
    let accuracyGrid = $("#final-stats").find(".final-stats-line").eq(2).find(".stat-grid");
    accuracyGrid.children().each(function(index) {
      if (index < schools.length) {
        let school = schools[index];
        $(this).find(".middle-floor2 .stat-value").text(aggregatedAccuracy[school] || 0);
      }
    });
    
    // Update Critical Rating section (fourth final-stats-line).
    let criticalGrid = $("#final-stats").find(".final-stats-line").eq(3).find(".stat-grid");
    criticalGrid.children().each(function(index) {
      if (index < schools.length) {
        let school = schools[index];
        $(this).find(".middle-floor2 .stat-value").text(aggregatedCritical[school] || 0);
      }
    });
    
    // Update Critical Block section (fifth final-stats-line).
    let critBlockGrid = $("#final-stats").find(".final-stats-line").eq(4).find(".stat-grid");
    critBlockGrid.children().each(function(index) {
      if (index < schools.length) {
        let school = schools[index];
        $(this).find(".middle-floor2 .stat-value").text(aggregatedCriticalBlock[school] || 0);
      }
    });
    
    // Update Armor Piercing section (sixth final-stats-line).
    let armorPiercingGrid = $("#final-stats").find(".final-stats-line").eq(5).find(".stat-grid");
    armorPiercingGrid.children().each(function(index) {
      if (index < schools.length) {
        let school = schools[index];
        $(this).find(".middle-floor2 .stat-value").text(aggregatedArmorPiercing[school] || 0);
      }
    });
    
    // Update Pip Conversion section (seventh final-stats-line).
    let pipConversionGrid = $("#final-stats").find(".final-stats-line").eq(6).find(".stat-grid");
    pipConversionGrid.children().each(function(index) {
      if (index < schools.length) {
        let school = schools[index];
        $(this).find(".middle-floor2 .stat-value").text(aggregatedPipConversion[school] || 0);
      }
    });
    
    // Update Other Stats section (eighth final-stats-line).
    // Order: 0: Stun Resistance, 1: Incoming Healing, 2: Outgoing Healing, 3: Power Pips, 4: Shadow Pip Bonus, 5: Archmastery.
    let otherStatsGrid = $("#final-stats").find(".final-stats-line").eq(7).find(".stat-grid");
    let otherStatsValues = [
      aggregatedStunResistance,
      aggregatedIncomingHealing,
      aggregatedOutgoingHealing,
      aggregatedPowerPip,
      aggregatedShadowPip,
      aggregatedArchmastery
    ];
    otherStatsGrid.children().each(function(index) {
      if (index < otherStatsValues.length) {
        $(this).find(".middle-floor2 .stat-value").text(otherStatsValues[index] || 0);
      }
    });
    
    // Update Vitals section (ninth final-stats-line).
    // Order: 0: Health, 1: Mana, 2: Energy.
    let vitalsGrid = $("#final-stats").find(".final-stats-line").eq(8).find(".stat-grid");
    let vitalsValues = [aggregatedHealth, aggregatedMana, aggregatedEnergy];
    vitalsGrid.children().each(function(index) {
      if (index < vitalsValues.length) {
        $(this).find(".middle-floor2 .stat-value").text(vitalsValues[index] || 0);
      }
    });
  }
  
  // Bind the Calculate button.
  $("#calculate-btn").click(function () {
    calculateFinalStats();
    $("html, body").animate({ scrollTop: $("#final-stats").offset().top }, 1000);
  });
  
  // Modified Clear button handler: Reset all fields, including final stats.
  $("#clear-btn").click(function (e) {
    e.preventDefault();
    // Clear selects in .container without triggering recursive updates.
    $(".container select").each(function(){
      $(this).val(null).trigger("change.select2");
    });
    // Clear number inputs.
    $(".container input[type='number']").val("");
    // Clear jewel container.
    $("#jewel-container").empty();
    // Clear final stats display.
    $("#final-stats .stat-value").text("0");
  });
  
  // ======================================
  // LOAD ALL DROPDOWNS SEQUENTIALLY
  // ======================================
  console.log("Loading all dropdowns on document ready");
  function loadCategoriesSequentially(categories) {
    if (categories.length === 0) {
      return $.Deferred().resolve().promise();
    }
    let category = categories.shift();
    return loadCategoryIndex(category, gearCategories[category])
      .then(function () {
        return new Promise(function (resolve) {
          setTimeout(resolve, 200);
        });
      })
      .then(function () {
        return loadCategoriesSequentially(categories);
      });
  }
  let categoriesToLoad = Object.keys(gearCategories);
  loadCategoriesSequentially(categoriesToLoad)
    .then(function () {
      updateGearDropdowns();
      $("#splash").fadeOut(500);
    })
    .catch(function (error) {
      console.error("Error loading categories sequentially:", error);
      $("#splash").text("Error loading data. Please refresh the page.");
    });
});
