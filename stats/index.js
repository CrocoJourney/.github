/**
 * Attention code moche et non optimisé
 * mais on s'en moque ici
 * 
 * @toxicbloud
 */

import dotenv from 'dotenv';

dotenv.config();
// load env
const TOKEN = process.env.TOKEN;

import {
  Octokit,
  App
} from "octokit";
const octokit = new Octokit({
  auth: TOKEN,
})
const FOLDER = '../profile/'

// get name in args
const args = process.argv.slice(2);

let REPO_NAME = args[0] ?? 'frontend';

const commits = await octokit.paginate('GET /repos/{owner}/{repo}/commits', {
  owner: 'CrocoJourney',
  repo: REPO_NAME,
  sha: 'dev',
  per_page: 1000,
  page: 1,
});

import fs from 'fs';
const mails = JSON.parse(fs.readFileSync('./users.json', 'utf8'));

function findNameByMail(db, mail) {
  // un user a plusieurs mails
  const user = db.find((user) => user.mails.includes(mail));
  return user?.name;
}
let activity = new Map();
// loading bar
import ProgressBar from 'progress';
const bar = new ProgressBar('Loading :bar :current/:total :percent :etas', {
  total: commits.length,
  width: 20,
  complete: '=',
  incomplete: '.',
});

for await (const commit of commits) {
  bar.tick();
  const name = findNameByMail(mails, commit.commit.author.email);
  if(name===undefined){
    console.log("🤖 euuuuuuuh : ", commit.commit.author.email+" \n");
    continue;
  }
  const comment = commit.commit.message;
  if (comment.toLocaleLowerCase().includes('merge')) {
    continue;
  }
  const info = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
    owner: 'CrocoJourney',
    repo: REPO_NAME,
    ref: commit.sha,
  })
  // console.log(info.data.files);
  // sum all files additions
  const additions = info.data.files.reduce((acc, file) => acc + file.additions, 0);
  // sum all files deletions
  const deletions = info.data.files.reduce((acc, file) => acc + file.deletions, 0);
  // console.log(name, additions, deletions);
  if (activity.has(name)) {
    // activity.set(name,activity.get(name)+1);
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
      commits: 1
    });
  }
}

// order activity by commits
activity = new Map([...activity.entries()].sort((a, b) => b[1].commits - a[1].commits));

// recupere celui qui a fait le plus de commit
const max = Math.max(...Array.from(activity.values()).map((value) => value.commits));
const maxName = Array.from(activity.keys()).find((key) => activity.get(key).commits === max);
console.log("🤖 : ", maxName, max);

// recupere celui qui a fait le plus de lignes ajoutées
const maxAdditions = Math.max(...Array.from(activity.values()).map((value) => value.additions));
const maxAdditionsName = Array.from(activity.keys()).find((key) => activity.get(key).additions === maxAdditions);
console.log("✍️ : ", maxAdditionsName, maxAdditions);

// recupere celui qui a fait le plus de lignes supprimées
const maxDeletions = Math.max(...Array.from(activity.values()).map((value) => value.deletions));
const maxDeletionsName = Array.from(activity.keys()).find((key) => activity.get(key).deletions === maxDeletions);
console.log("🗑️ : ", maxDeletionsName, maxDeletions);

console.log("Ratio ajout/suppression par personne");
// ratio ajout/suppression par personne
activity.forEach((value, key) => {
  console.log(key, value.additions / value.deletions);
})

console.log("Delta de lignes ajoutées/supprimées par personne");
// delta de lignes ajoutées/supprimées par personne
activity.forEach((value, key) => {
  console.log(key, value.additions - value.deletions);
})

// dessine un graphique
import {
  ChartJSNodeCanvas
} from "chartjs-node-canvas";
const width = 800;
const height = 600;
const chartCallback = (ChartJS) => {}
const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width,
  height,
  backgroundColour: '#ffffff',
  chartCallback
});
const configuration = {
  type: 'bar',
  data: {
    // nombre de lignes ajoutées/supprimées par personne delta  nombre de lignes ajoutées/supprimées  + personne
    labels: Array.from(activity.keys()),
    datasets: [{
      label: 'Ajouts',
      data: Array.from(activity.values()).map((value) => value.additions),
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }, {
      label: 'Supressions',
      data: Array.from(activity.values()).map((value) => value.deletions),
      backgroundColor: 'rgba(255, 206, 86, 0.2)',
      borderColor: 'rgba(255, 206, 86, 1)',
      borderWidth: 1
    }, {
      label: 'Delta (ajouts - supressions)',
      data: Array.from(activity.values()).map((value) => value.additions - value.deletions),
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1

    }, {
      label: 'Nombre de Lignes modifiées par commit',
      data: Array.from(activity.values()).map((value) => (value.additions + value.deletions) / value.commits),
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 1
    }]
  },
  options: {
    plugins: {

      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Activité par personne (' + REPO_NAME + ')'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    },
    animation: {
      onComplete: function () {
        console.log("animation complete");
        const chartInstance = this.chart,
          ctx = chartInstance.ctx;
        ctx.font = ChartJSNodeCanvas.fontString(ChartJSNodeCanvas.defaults.global.defaultFontSize, 'normal', ChartJSNodeCanvas.defaults.global.defaultFontFamily);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        this.data.datasets.forEach(function (dataset, i) {
          const meta = chartInstance.controller.getDatasetMeta(i);
          meta.data.forEach(function (bar, index) {
            const data = dataset.data[index];
            ctx.fillText(data, bar._model.x, bar._model.y - 5);
          });
        });
      }
    }
  }
};
const image = await chartJSNodeCanvas.renderToBuffer(configuration);

// Write to a file
fs.writeFileSync(FOLDER + REPO_NAME + '_chart.png', image);


// generer autant de couleurs que de personnes en les gardant le plus distinctes possibles
import {
  generateRandomColors
} from "./utils.js";
const colors = generateRandomColors(1, generateRandomColors(6))
// ajout l'opacité a 0.2 aux couleurs hexa
colors.forEach((color, index) => {
  // hex to rgba
  const rgba = color.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b)
    .substring(1).match(/.{2}/g)
    .map(x => parseInt(x, 16));
  colors[index] = `rgba(${rgba[0]},${rgba[1]},${rgba[2]},0.2)`;
})

// graph camembert des commits
const configuration2 = {
  type: 'doughnut',
  data: {
    // nombre commits + nom
    labels: Array.from(activity.keys()).map((key) => key + ' (' + activity.get(key).commits + ')'),
    datasets: [{
      label: 'Commits',
      data: Array.from(activity.values()).map((value) => value.commits),
      backgroundColor: colors,
      borderColor: colors,
      borderWidth: 1
    }]
  },
  onAnimationComplete: (context) => {
    // affiche le nombre de commits a coté de chaque tranche
    const chartInstance = context.chart;
    const ctx = chartInstance.ctx;
    ctx.font = ChartJSNodeCanvas.fontString(ChartJSNodeCanvas.defaults.global.defaultFontSize, 'normal', ChartJSNodeCanvas.defaults.global.defaultFontFamily);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
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
        ctx.font = ChartJSNodeCanvas.fontString(ChartJSNodeCanvas.defaults.global.defaultFontSize, 'normal', ChartJSNodeCanvas.defaults.global.defaultFontFamily);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        context.data.datasets.forEach((dataset, i) => {
          const meta = chartInstance.controller.getDatasetMeta(i);
          meta.data.forEach((bar, index) => {
            const data = dataset.data[index];
            ctx.fillText(data, bar._model.x, bar._model.y - 5);
          });
        });
      }

    },
    // ajoute le nombre de commits a coté de chaque tranche
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Commits par personne (' + REPO_NAME + ')',
      },
      dataLabels: {
        display: true,
        color: 'black',
        position: 'inside',
        font: {
          weight: 'bold',
          size: 16,
        },
        formatter: (value) => {
          return context.chart.data.labels[context.dataIndex] + ': ' + value;
        }
      }
    }
  }
};
const image2 = await chartJSNodeCanvas.renderToBuffer(configuration2);

// Write to a file
fs.writeFileSync(FOLDER + REPO_NAME + '_chart2.png', image2);


// put image side by side
import {
  createCanvas,
  loadImage
} from 'canvas'
const canvas = createCanvas(width * 2, height);
const ctx = canvas.getContext('2d');
const image1 = await loadImage(FOLDER + REPO_NAME + '_chart.png');
const image3 = await loadImage(FOLDER + REPO_NAME + '_chart2.png');
ctx.drawImage(image1, 0, 0);
ctx.drawImage(image3, width, 0);
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(FOLDER + REPO_NAME + '.png', buffer);

const configuration3 = {
  type: 'radar',
  data: {
    // nombre lignes ajoutées  supprimées + nom
    labels: Array.from(activity.keys()).map((key) => key + ' (' + activity.get(key).additions + '✅/❌' + activity.get(key).deletions + ')'),
    datasets: [{
      label: 'Additions',
      data: Array.from(activity.values()).map((value) => value.additions),
      // light green
      backgroundColor: 'rgba(54, 162, 100, 0.2)',
      borderColor: 'rgba(54, 162, 100, 1)',
      borderWidth: 1
    }, {
      label: 'Deletions',
      data: Array.from(activity.values()).map((value) => value.deletions),
      // light red
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 1
    }, {
      label: 'Commits',
      data: Array.from(activity.values()).map((value) => value.commits),
      // light blue
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1

    }]
  },
  options: {
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Activité par personne (' + REPO_NAME + ')'
      }
    },
    scales: {
      r: {
        angleLines: {
          display: false
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        pointLabels: {
          color: 'black'
        },
        ticks: {
          backdropColor: 'rgba(255, 255, 255, 0.5)'
        }
      }
    }
  }
};
const image4 = await chartJSNodeCanvas.renderToBuffer(configuration3);

// Write to a file
fs.writeFileSync(FOLDER + REPO_NAME + '_chart4.png', image4);

// diagramme camembert des lignes de code
const configuration5 = {
  type: 'doughnut',
  data: {
    // nombre commits + nom
    labels: Array.from(activity.keys()).map((key) => key + ' (' + activity.get(key).additions + ')'),
    datasets: [{
      label: 'Additions',
      data: Array.from(activity.values()).map((value) => value.additions),
      backgroundColor: colors,
      borderColor: colors,
      borderWidth: 1
    }]
  },
  onAnimationComplete: (context) => {
    // affiche le nombre de commits a coté de chaque tranche
    const chartInstance = context.chart;
    const ctx = chartInstance.ctx;
    ctx.font = ChartJSNodeCanvas.fontString(ChartJSNodeCanvas.defaults.global.defaultFontSize, 'normal', ChartJSNodeCanvas.defaults.global.defaultFontFamily);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    context.data.datasets.forEach((dataset, i) => {
      const meta = chartInstance.controller.getDatasetMeta(i);
      meta.data.forEach((bar, index) => {
        const data = dataset.data[index];
        ctx.fillText(data, bar._model.x, bar._model.y - 5);
      });
    });
  }
};
const image5 = await chartJSNodeCanvas.renderToBuffer(configuration5);

// Write to a file
fs.writeFileSync(FOLDER + REPO_NAME + '_chart5.png', image5);