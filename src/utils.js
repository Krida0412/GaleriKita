// Numeric filters reject unknown measurements rather than guessing a value.
function measurement(value) {
  const s=String(value ?? '').trim().toLowerCase();
  if (!s) return 0;
  const number = v => Number(v.includes(',') ? v.replace(/\./g,'').replace(',','.') : /^\d{1,3}(\.\d{3})+$/.test(v) ? v.replace(/\./g,'') : v);
  const dimensions=s.match(/^([\d.,]+)\s*[x×]\s*([\d.,]+)/);
  if(dimensions) return number(dimensions[1])*number(dimensions[2]);
  const found=s.match(/^[\s±~]*([\d.,]+)/);
  return found ? number(found[1]) || 0 : 0;
}
function matchesSpecs(details, filters) {
  return (!filters.building || measurement(details.buildingArea || details.area)>=filters.building)
    && (!filters.land || measurement(details.landArea)>=filters.land)
    && (!filters.beds || Number(details.beds)>=filters.beds)
    && (!filters.baths || Number(details.baths)>=filters.baths);
}
