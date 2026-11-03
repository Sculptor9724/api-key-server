function getGradeCriteriaText(gradeCriteria) {
  let gradeCriteriaReturn = "";
  if (gradeCriteria === "7-skala") {
    gradeCriteriaReturn = `12 \tDen fremragende præstation \tKarakteren 12 gives for den fremragende præstation, der demonstrerer udtømmende opfyldelse af fagets mål, med ingen eller få uvæsentlige mangler \tA
        10 \tDen fortrinlige præstation \tKarakteren 10 gives for den fortrinlige præstation, der demonstrerer omfattende opfyldelse af fagets mål, med nogle mindre væsentlige mangler \tB
        7 \tDen gode præstation \tKarakteren 7 gives for den gode præstation, der demonstrerer opfyldelse af fagets mål, med en del mangler \tC
        4 \tDen jævne præstation \tKarakteren 4 gives for den jævne præstation, der demonstrerer en mindre grad af opfyldelse af fagets mål, med adskillige væsentlige mangler \tD
        02 \tDen tilstrækkelige præstation \tKarakteren 02 gives for den tilstrækkelige præstation, der demonstrerer den minimalt acceptable grad af opfyldelse af fagets mål \tE
        00 \tDen utilstrækkelige præstation \tKarakteren 00 gives for den utilstrækkelige præstation, der ikke demonstrerer en acceptabel grad af opfyldelse af fagets mål \tFx
        -3 \tDen ringe præstation \tKarakteren -3 gives for den helt uacceptable præstation \tF`;
  } else if (gradeCriteria === "bestået-ikke-bestået") {
    gradeCriteriaReturn = `Bestået/Ikke bestået`;
  } else if (gradeCriteria === "no-grade") {
    gradeCriteriaReturn = `The student should not get a grade!`;
  }
  return gradeCriteriaReturn;
}

module.exports = getGradeCriteriaText;

