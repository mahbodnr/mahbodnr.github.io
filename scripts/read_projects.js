
const papers = [
    {
        imageSrc: './img/research/LC.png',
        title: 'BioLCNet: Reward-Modulated Locally Connected Spiking Neural Networks',
        text: ' Machine Learning, Optimization, and Data Science: 8th International Workshop, LOD 2022',
        date: "2023/3/10",
        link: 'https://link.springer.com/chapter/10.1007/978-3-031-25891-6_42',
    },
    {
        imageSrc: './img/research/CSP figure.jpg',
        title: 'Towards real-world BCI: CCSPNet, a compact subject-independent motor imagery framework',
        text: 'Digital Signal Processing',
        date: "2023/3/1",
        link: 'https://www.sciencedirect.com/science/article/abs/pii/S105120042200433X',
    },
];


const conferences = [
    {
        // imageSrc: './img/github.png',
        title: '2nd Advanced Course & Symposium on Artificial Intelligence & Neuroscience (ACAIN 2022)',
        text: 'Presented research: “BioLCNet: Reward-Modulated Locally Connected Spiking Neural Networks”',
        date: "September 2022",
    },
];

const projects = [
    {
        imageSrc: './img/research/cough-cover.jpg',
        title: 'COVID-19 diagnosis via cough sound',
        text: 'This project is done at the University of Tehran Advanced Robotics and Intelligent Systems Lab. The project used deep learning to diagnose COVID-19 from subjects’ cough sounds.',
        date: "2020-01-01",
        // link: '',
    },
    {
        imageSrc: './img/research/mask-detection-cover.jpg',
        title: "Mask detection",
        text: 'In this project, I have developed a “mask detection” model. This model can detect whether a person is wearing a mask or not, as well as determine if the mask is worn correctly. The model is finally implemented on real-time video.',
        // link: '',
    },
    {
        imageSrc: './img/research/bachelor-thesis-cover.jpg',
        title: "Bachelor's Thesis",
        text: 'In this project, a number of segmentation models are purposed on COVID-19 CT scan data, using fully convolutional Neural Networks, namely UNet, UNet++, and Deep Supervision.',
        // link: '',
    },
];

function createResearchElement(research) {
    const researchElement = document.createElement('div');
    researchElement.classList.add('research');

    if (research.imageSrc) {
        const imageElement = document.createElement('img');
        imageElement.src = research.imageSrc;
        imageElement.alt = research.title;
        researchElement.appendChild(imageElement);
    }

    const researchElementText = document.createElement('div');
    researchElement.classList.add('research-text');
    researchElement.appendChild(researchElementText);

    const titleElement = document.createElement('h2');
    titleElement.textContent = research.title;
    researchElementText.appendChild(titleElement);

    if (research.date) {
        const dateElement = document.createElement('p');
        dateElement.textContent = research.date;
        dateElement.className = "date";
        researchElementText.appendChild(dateElement);
    }

    const textElement = document.createElement('p');
    textElement.textContent = research.text;
    researchElementText.appendChild(textElement);

    if (research.link) {
        const linkElement = document.createElement('a');
        linkElement.href = research.link;
        linkElement.textContent = 'Read More';
        researchElementText.appendChild(linkElement);
    }

    return researchElement;
}

function renderSections() {
    const sectionsContainer = document.querySelector('#research');
    const sections = [papers, conferences, projects];
    const labels = ["Selected Papers", "Conferences", "Projects"];

    for (var i = 0; i < labels.length; i++) {
        const labelElement = document.createElement('h1');
        labelElement.textContent = labels[i];
        sectionsContainer.appendChild(labelElement);
        for (var j = 0; j < sections[i].length; j++) {
            const sectionElement = createResearchElement(sections[i][j]);
            sectionsContainer.appendChild(sectionElement);
            // for all instead of last item in section
            if (j != sections[i].length - 1) {
                const horizontalLine = document.createElement('hr');
                sectionsContainer.appendChild(horizontalLine);
            }
        }
    }

    const labelElement = document.createElement('h1');
    labelElement.innerHTML = "<wbr>";
    sectionsContainer.appendChild(labelElement);
}

renderSections();
