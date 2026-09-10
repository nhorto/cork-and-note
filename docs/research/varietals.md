# Varietal catalogue

`lib/varietals.js` supplies both tasting and cellar autocomplete. It is a curated
list of label names, not an exhaustive botanical registry. It includes regional
European varieties and North American hybrids alongside familiar grapes.

References used for the September 2026 expansion:

- [Virginia Wine varieties](https://pages.virginiawine.org/varietals/): local gaps
  including Petit Manseng, Rkatsiteli and Traminette.
- [University of Minnesota cultivars](https://enology.umn.edu/growing-grapes/cultivars):
  Frontenac, Marquette, La Crescent, Itasca and Clarion, including the separate
  Frontenac Blanc and Gris varieties.
- [Australian Wine Research Institute grape varieties](https://www.awri.com.au/industry_support/viticulture/grapevine-varieties/):
  regional grape names grouped by red and white, including Grenache Blanc,
  Savagnin, Grillo, Schioppettino and Alicante Bouschet.
- [Wines of Portugal grape varieties](https://winesofportugal.com/en/portuguese-wines/grape-varieties/):
  Portuguese label names including Arinto, Encruzado, Fernão Pires, Baga,
  Touriga Franca and Trincadeira.
- [Wines of Germany grape varieties](https://www.winesofgermany.com/our-wine/grape-varieties):
  German varieties and local names for Pinot grapes.

## Maintenance

- Add grapes to the appropriate red or white group. Type inference is a default
  for wine entry, not a restriction on the styles a grape can produce.
- Preserve existing labels (including synonyms already offered separately) so
  saved entries and familiar options remain stable. Add alternate label names
  to `ALIASES` when a new display entry is unnecessary. Exact display names take
  precedence over aliases.
- Historical sparkling, dessert and blend labels remain available. Named blends
  do not infer a type. Do not add new appellations as though they were grapes.
- Both pickers use `searchVarietals`, which ignores accents, spacing and
  punctuation, searches aliases, and ranks exact names before prefixes and
  substrings. All matches remain accessible in the scrollable dropdown.
- Custom values remain valid. In tasting entry, type the grape and tap `+`;
  in cellar entry, leave the typed value in the field. No database migration or
  rewriting of existing records is needed when expanding the catalogue.
