/**
 * Attention code moche et non optimisé
 * mais on s'en moque ici
 *
 * @toxicbloud
 */

import dotenv from "dotenv";

dotenv.config();
// load env
const TOKEN = process.env.TOKEN;

import { Octokit, App } from "octokit";
const octokit = new Octokit({
  auth: TOKEN,
});
const FOLDER = "../profile/";

// get name in args
const args = process.argv.slice(2);

let REPO_NAME = args[0] ?? "frontend";

import fs from "fs";
const mails = JSON.parse(fs.readFileSync("./users.json", "utf8"));

function findNameByMail(db, mail) {
  // un user a plusieurs mails
  const user = db.find((user) => user.mails.includes(mail));
  return user?.name;
}

import { ChartJSNodeCanvas } from "chartjs-node-canvas";
const width = 800;
const height = 600;
const chartCallback = (ChartJS) => {};
const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width,
  height,
  backgroundColour: "#ffffff",
  chartCallback,
});

const genCalendar = async () => {
  const commitsG = new Array();
  const commitsFrontend = await octokit.paginate(
    "GET /repos/{owner}/frontend/commits",
    {
      owner: "CrocoJourney",
      sha: "dev",
    }
  );
  for await (const commit of commitsFrontend) {
    // recup les infos du commit via l'api
    await octokit
      .request("GET /repos/{owner}/{repo}/commits/{ref}", {
        owner: "CrocoJourney",
        repo: "frontend",
        ref: commit.sha,
      })
      .then((response) => {
        const comment = commit.commit.message;
        if (comment.toLocaleLowerCase().includes("merge")) {
          return;
        }
        // on regarde si au moins un fichier modifié est dans app ou src
        const files = response.data.files;
        const isApp = files.some((file) => file.filename.includes("app"));
        const isSrc = files.some((file) => file.filename.includes("src"));
        if (isApp || isSrc) {
          // on ajoute le commit a la liste
          commitsG.push(commit);
        }
      });
  }
  const commitsBackend = await octokit.paginate(
    "GET /repos/{owner}/backend/commits",
    {
      owner: "CrocoJourney",
      sha: "dev",
    }
  );
  for await (const commit of commitsBackend) {
    // recup les infos du commit via l'api
    await octokit
      .request("GET /repos/{owner}/{repo}/commits/{ref}", {
        owner: "CrocoJourney",
        repo: "backend",
        ref: commit.sha,
      })
      .then((response) => {
        const comment = commit.commit.message;
        if (comment.toLocaleLowerCase().includes("merge")) {
          return;
        }

        // on regarde si au moins un fichier modifié est dans app ou src
        const files = response.data.files;
        const isApp = files.some(
          (file) =>
            file.filename.includes("app") && !file.filename.includes("test")
        );
        const isSrc = files.some((file) => file.filename.includes("src"));
        // no merge
        if (isApp || isSrc) {
          // on ajoute le commit a la liste
          commitsG.push(commit);
        }
      });
  }
  // merge les commits
  // const commitsG = commitsFrontend.concat(commitsBackend);

  // trie les commits par date
  commitsG.sort((a, b) => {
    return new Date(a.commit.author.date) - new Date(b.commit.author.date);
  });

  // genere une liste par utilisateur avec le nombre de commits
  const commitsByUser = new Map();
  for (const commit of commitsG) {
    const user = findNameByMail(mails, commit.commit.author.email);
    if (commitsByUser.has(user)) {
      commitsByUser.set(user, commitsByUser.get(user).concat(commit));
    } else {
      commitsByUser.set(user, new Array(commit));
    }
  }
  for (const user of commitsByUser.keys()) {
    console.log(user + " : " + commitsByUser.get(user).length);
  }

  const calendriersNames = new Array();

  // pour chaque utilisateur
  for (const user of commitsByUser.keys()) {
    // merge les commits qui sont le même jour et mets comme valeur le nombre de commits
    const commitsO = [];
    let i = 0;
    while (i < commitsByUser.get(user).length) {
      let j = i + 1;
      while (
        j < commitsByUser.get(user).length &&
        new Date(
          commitsByUser.get(user)[i].commit.author.date
        ).toLocaleDateString() ===
          new Date(
            commitsByUser.get(user)[j].commit.author.date
          ).toLocaleDateString()
      ) {
        j++;
      }
      commitsO.push({
        date: commitsByUser.get(user)[i].commit.author.date,
        commits: j - i,
      });
      i = j;
    }

    console.log("Commits: " + commitsByUser.get(user).length);

    // dessine un graphique en barres avec les commits par jour la hauteur de la barre est le nombre de commits
    const configuration6 = {
      type: "bar",
      data: {
        labels: commitsO.map((commit) =>
          new Date(commit.date).toLocaleDateString("fr-FR")
        ),

        datasets: [
          {
            label: "Commits",
            data: commitsO.map((commit) => commit.commits),
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            position: "right",
          },
          title: {
            display: true,
            // margin bottom
            padding: {
              up: 20,
              bottom: 20,
            },
            margin: {
              bottom: 20,
            },
            text:
              "Calendrier des commits de : " +
              user +
              "\n premier commit le " +
              new Date(
                commitsByUser.get(user)[0].commit.author.date
              ).toLocaleDateString("fr-FR") +
              "\n dernier commit le " +
              new Date(
                commitsByUser.get(user)[
                  commitsByUser.get(user).length - 1
                ].commit.author.date
              ).toLocaleDateString("fr-FR") +
              "\n nombre de commits : " +
              commitsByUser.get(user).length,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    };

    const image6 = await chartJSNodeCanvas.renderToBuffer(configuration6);

    // Write to a file
    const filename = user.replace(/ /g, "_") + "_calendar.png";
    // replace space by underscore
    calendriersNames.push(filename.replace(/ /g, "_"));
    fs.writeFileSync(FOLDER + filename, image6);
  }

  const canvasCalandar = createCanvas(
    width * 3,
    height * Math.ceil(calendriersNames.length / 3) + 100
  );
  const ctxCalendar = canvasCalandar.getContext("2d");

  // dessine le titre sur fond blanc
  ctxCalendar.fillStyle = "white";
  ctxCalendar.fillRect(0, 0, width * 3, 100);
  ctxCalendar.fillStyle = "black";
  ctxCalendar.font = "40px Arial";
  ctxCalendar.fillText(
    "Calendriers des commits de chaque personne après filtrage",
    10,
    50
  );
  // dessine un rectangle blanc

  // dessine les calendriers dans une grille de maniere a ce qu'il y ait 3 calendriers par ligne max
  let x = 0;
  let y = 100;
  for (const calendrier of calendriersNames) {
    console.log(x, " : ", y);
    const image = await loadImage(FOLDER + calendrier);
    ctxCalendar.drawImage(image, x, y, width, height);
    x += width;
    if (x >= width * 3) {
      x = 0;
      y += height;
    }
    // print the name of the user
    console.log(calendrier);
  }

  console.log(calendriersNames.length + " calendriers générés");

  const bufferCalendrier = canvasCalandar.toBuffer("image/png");
  // Write to a file
  fs.writeFileSync(FOLDER + "calendrier.png", bufferCalendrier);
};

if (args[0] == "calendar") {
  await genCalendar();
  exit(0);
}

const commits = await octokit.paginate("GET /repos/{owner}/{repo}/commits", {
  owner: "CrocoJourney",
  repo: REPO_NAME,
  sha: "dev",
  per_page: 1000,
  page: 1,
});
let activity = new Map();
// loading bar
import ProgressBar from "progress";
import { exit } from "process";
const bar = new ProgressBar("Loading :bar :current/:total :percent :etas", {
  total: commits.length,
  width: 20,
  complete: "=",
  incomplete: ".",
});

for await (const commit of commits) {
  bar.tick();
  const name = findNameByMail(mails, commit.commit.author.email);
  if (name === undefined) {
    console.log("🤖 euuuuuuuh : ", commit.commit.author.email + " \n");
    continue;
  }
  const comment = commit.commit.message;
  if (comment.toLocaleLowerCase().includes("merge")) {
    continue;
  }
  const info = await octokit.request(
    "GET /repos/{owner}/{repo}/commits/{ref}",
    {
      owner: "CrocoJourney",
      repo: REPO_NAME,
      ref: commit.sha,
    }
  );

  // calcul les additions en evitant les packages.json et package-lock.json et les fichier de test et ne prend que ce qui est dans src ou app
  const additions = info.data.files
    .filter(
      (file) =>
        !file.filename.includes("package") &&
        !file.filename.includes("test") &&
        (file.filename.includes("src") || file.filename.includes("app"))
    )
    .reduce((acc, file) => acc + file.additions, 0);
  // calcul les deletions en evitant les packages.json et package-lock.json et les fichier de test
  const deletions = info.data.files
    .filter(
      (file) =>
        !file.filename.includes("package") &&
        !file.filename.includes("test") &&
        (file.filename.includes("src") || file.filename.includes("app"))
    )
    .reduce((acc, file) => acc + file.deletions, 0);
  // test si les additions et les deletions sont nulles
  if (additions === 0 && deletions === 0) {
    console.log(name + " : commit vide après filtrage");
    continue;
  }

  if (activity.has(name)) {
    const value = activity.get(name);
    value.additions += additions;
    value.deletions += deletions;
    value.commits += 1;
    activity.set(name, value);
  } else {
    // activity.set(name,1);
    activity.set(name, {
      additions,
      deletions,
      commits: 1,
    });
  }
}

// order activity by commits
activity = new Map(
  [...activity.entries()].sort((a, b) => b[1].commits - a[1].commits)
);

// recupere celui qui a fait le plus de commit
const max = Math.max(
  ...Array.from(activity.values()).map((value) => value.commits)
);
const maxName = Array.from(activity.keys()).find(
  (key) => activity.get(key).commits === max
);
console.log("🤖 : ", maxName, max);

// recupere celui qui a fait le plus de lignes ajoutées
const maxAdditions = Math.max(
  ...Array.from(activity.values()).map((value) => value.additions)
);
const maxAdditionsName = Array.from(activity.keys()).find(
  (key) => activity.get(key).additions === maxAdditions
);
console.log("✍️ : ", maxAdditionsName, maxAdditions);

// recupere celui qui a fait le plus de lignes supprimées
const maxDeletions = Math.max(
  ...Array.from(activity.values()).map((value) => value.deletions)
);
const maxDeletionsName = Array.from(activity.keys()).find(
  (key) => activity.get(key).deletions === maxDeletions
);
console.log("🗑️ : ", maxDeletionsName, maxDeletions);

console.log("Ratio ajout/suppression par personne");
// ratio ajout/suppression par personne
activity.forEach((value, key) => {
  console.log(key, value.additions / value.deletions);
});

console.log("Delta de lignes ajoutées/supprimées par personne");
// delta de lignes ajoutées/supprimées par personne
activity.forEach((value, key) => {
  console.log(key, value.additions - value.deletions);
});

// dessine un graphique

const configuration = {
  type: "bar",
  data: {
    // nombre de lignes ajoutées/supprimées par personne delta  nombre de lignes ajoutées/supprimées  + personne
    labels: Array.from(activity.keys()),
    datasets: [
      {
        label: "Ajouts",
        data: Array.from(activity.values()).map((value) => value.additions),
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      },
      {
        label: "Supressions",
        data: Array.from(activity.values()).map((value) => value.deletions),
        backgroundColor: "rgba(255, 206, 86, 0.2)",
        borderColor: "rgba(255, 206, 86, 1)",
        borderWidth: 1,
      },
      {
        label: "Delta (ajouts - supressions)",
        data: Array.from(activity.values()).map(
          (value) => value.additions - value.deletions
        ),
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
      {
        label: "Nombre de Lignes modifiées par commit",
        data: Array.from(activity.values()).map(
          (value) => (value.additions + value.deletions) / value.commits
        ),
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      },
    ],
  },
  options: {
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Activité par personne (" + REPO_NAME + ")",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
    animation: {
      onComplete: function () {
        console.log("animation complete");
        const chartInstance = this.chart,
          ctx = chartInstance.ctx;
        ctx.font = ChartJSNodeCanvas.fontString(
          ChartJSNodeCanvas.defaults.global.defaultFontSize,
          "normal",
          ChartJSNodeCanvas.defaults.global.defaultFontFamily
        );
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        this.data.datasets.forEach(function (dataset, i) {
          const meta = chartInstance.controller.getDatasetMeta(i);
          meta.data.forEach(function (bar, index) {
            const data = dataset.data[index];
            ctx.fillText(data, bar._model.x, bar._model.y - 5);
          });
        });
      },
    },
  },
};
const image = await chartJSNodeCanvas.renderToBuffer(configuration);

// Write to a file
fs.writeFileSync(FOLDER + REPO_NAME + "_chart.png", image);

// generer autant de couleurs que de personnes en les gardant le plus distinctes possibles
import { generateRandomColors } from "./utils.js";
const colors = generateRandomColors(1, generateRandomColors(6));
// ajout l'opacité a 0.2 aux couleurs hexa
colors.forEach((color, index) => {
  // hex to rgba
  const rgba = color
    .replace(
      /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
      (m, r, g, b) => "#" + r + r + g + g + b + b
    )
    .substring(1)
    .match(/.{2}/g)
    .map((x) => parseInt(x, 16));
  colors[index] = `rgba(${rgba[0]},${rgba[1]},${rgba[2]},0.2)`;
});

// graph camembert des commits
const configuration2 = {
  type: "doughnut",
  data: {
    // nombre commits + nom
    labels: Array.from(activity.keys()).map(
      (key) => key + " (" + activity.get(key).commits + ")"
    ),
    datasets: [
      {
        label: "Commits",
        data: Array.from(activity.values()).map((value) => value.commits),
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1,
      },
    ],
  },
  onAnimationComplete: (context) => {
    // affiche le nombre de commits a coté de chaque tranche
    const chartInstance = context.chart;
    const ctx = chartInstance.ctx;
    ctx.font = ChartJSNodeCanvas.fontString(
      ChartJSNodeCanvas.defaults.global.defaultFontSize,
      "normal",
      ChartJSNodeCanvas.defaults.global.defaultFontFamily
    );
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    context.data.datasets.forEach((dataset, i) => {
      const meta = chartInstance.controller.getDatasetMeta(i);
      meta.data.forEach((bar, index) => {
        const data = dataset.data[index];
        ctx.fillText(data, bar._model.x, bar._model.y - 5);
      });
    });
  },
  options: {
    animation: {
      duration: 1,
      onComplete: (context) => {
        // affiche le nombre de commits a coté de chaque tranche
        const chartInstance = context.chart;
        const ctx = chartInstance.ctx;
        ctx.font = ChartJSNodeCanvas.fontString(
          ChartJSNodeCanvas.defaults.global.defaultFontSize,
          "normal",
          ChartJSNodeCanvas.defaults.global.defaultFontFamily
        );
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        context.data.datasets.forEach((dataset, i) => {
          const meta = chartInstance.controller.getDatasetMeta(i);
          meta.data.forEach((bar, index) => {
            const data = dataset.data[index];
            ctx.fillText(data, bar._model.x, bar._model.y - 5);
          });
        });
      },
    },
    // ajoute le nombre de commits a coté de chaque tranche
    plugins: {
      legend: {
        position: "right",
      },
      title: {
        display: true,
        text: "Commits par personne (" + REPO_NAME + ")",
      },
      dataLabels: {
        display: true,
        color: "black",
        position: "inside",
        font: {
          weight: "bold",
          size: 16,
        },
        formatter: (value) => {
          return context.chart.data.labels[context.dataIndex] + ": " + value;
        },
      },
    },
  },
};
const image2 = await chartJSNodeCanvas.renderToBuffer(configuration2);

// Write to a file
fs.writeFileSync(FOLDER + REPO_NAME + "_chart2.png", image2);

// put image side by side
import { createCanvas, loadImage } from "canvas";
import { log } from "console";

const canvas = createCanvas(width * 2, height);
const ctx = canvas.getContext("2d");
const image1 = await loadImage(FOLDER + REPO_NAME + "_chart.png");
const image3 = await loadImage(FOLDER + REPO_NAME + "_chart2.png");
ctx.drawImage(image1, 0, 0);
ctx.drawImage(image3, width, 0);
const buffer = canvas.toBuffer("image/png");
fs.writeFileSync(FOLDER + REPO_NAME + ".png", buffer);

const configuration3 = {
  type: "radar",
  data: {
    // nombre lignes ajoutées  supprimées + nom
    labels: Array.from(activity.keys()).map(
      (key) =>
        key +
        " (" +
        activity.get(key).additions +
        "✅/❌" +
        activity.get(key).deletions +
        ")"
    ),
    datasets: [
      {
        label: "Additions",
        data: Array.from(activity.values()).map((value) => value.additions),
        // light green
        backgroundColor: "rgba(54, 162, 100, 0.2)",
        borderColor: "rgba(54, 162, 100, 1)",
        borderWidth: 1,
      },
      {
        label: "Deletions",
        data: Array.from(activity.values()).map((value) => value.deletions),
        // light red
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      },
      {
        label: "Commits",
        data: Array.from(activity.values()).map((value) => value.commits),
        // light blue
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      },
    ],
  },
  options: {
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Activité par personne (" + REPO_NAME + ")",
      },
    },
    scales: {
      r: {
        angleLines: {
          display: false,
        },
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
        pointLabels: {
          color: "black",
        },
        ticks: {
          backdropColor: "rgba(255, 255, 255, 0.5)",
        },
      },
    },
  },
};
const image4 = await chartJSNodeCanvas.renderToBuffer(configuration3);

// Write to a file
fs.writeFileSync(FOLDER + REPO_NAME + "_chart4.png", image4);

// diagramme camembert des lignes de code
const configuration5 = {
  type: "doughnut",
  data: {
    // nombre commits + nom
    labels: Array.from(activity.keys()).map(
      (key) => key + " (" + activity.get(key).additions + ")"
    ),
    datasets: [
      {
        label: "Additions",
        data: Array.from(activity.values()).map((value) => value.additions),
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1,
      },
    ],
  },
  onAnimationComplete: (context) => {
    // affiche le nombre de commits a coté de chaque tranche
    const chartInstance = context.chart;
    const ctx = chartInstance.ctx;
    ctx.font = ChartJSNodeCanvas.fontString(
      ChartJSNodeCanvas.defaults.global.defaultFontSize,
      "normal",
      ChartJSNodeCanvas.defaults.global.defaultFontFamily
    );
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    context.data.datasets.forEach((dataset, i) => {
      const meta = chartInstance.controller.getDatasetMeta(i);
      meta.data.forEach((bar, index) => {
        const data = dataset.data[index];
        ctx.fillText(data, bar._model.x, bar._model.y - 5);
      });
    });
  },
};
const image5 = await chartJSNodeCanvas.renderToBuffer(configuration5);

// Write to a file
fs.writeFileSync(FOLDER + REPO_NAME + "_chart5.png", image5);
