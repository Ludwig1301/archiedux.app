export const scenes = [
  {
    id: "tears-of-steel-opening",
    title: "Tutkuların peşinde",
    film: "Tears of Steel",
    year: 2012,
    duration: "00:08",
    age: "12+",
    players: 2,
    category: "Bilim kurgu",
    sourceStart: 23,
    sourceEnd: 31,
    videoId: "41hv2tW5Lc4",
    sourceUrl: "https://mango.blender.org/download/",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    credit:
      "Tears of Steel (2012), Blender Foundation — CC BY 3.0. Video: official Blender Foundation YouTube embed. Turkish subtitles are an adaptation.",
    characters: [
      { id: "thom", name: "Thom", color: "#e0bd4a" },
      { id: "celia", name: "Celia", color: "#a7c4b6" },
    ],
    lines: [
      {
        id: "celia-1",
        characterId: "celia",
        start: 23,
        end: 24.5,
        text: "Ne gıcık adamsın, Thom.",
      },
      {
        id: "thom-2",
        characterId: "thom",
        start: 25,
        end: 30.5,
        text: "Celia, tutkularımızın peşinden gitmeliyiz; sen robotik işlerinle, ben de uzayda harika olmakla uğraşmak istiyorum.",
      },
    ],
  },
];

export function getScene(sceneId) {
  return scenes.find((scene) => scene.id === sceneId);
}
