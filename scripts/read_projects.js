const papers = [
    {
        imageSrc: './img/compass_attention.png',
        title: 'Compass Attention: Directional Positional Encoding for Resolution-Robust Vision Transformers',
        tags: [{ label: 'Under review', style: 'review' }],
        text: 'A positional encoding for Vision Transformers that lets each patch attend by content, direction ("compass") and distance, so models keep working when evaluated at resolutions they were not trained on.',
    },
    {
        imageSrc: './img/research/Frontiers25.jpg',
        title: 'Interleaving cortex-analog mixing improves deep non-negative matrix factorization networks',
        venue: 'Frontiers in Computational Neuroscience',
        date: 'Nov 2025',
        text: 'Deep networks built from non-negative matrix factorization (NMF) modules respect the positivity of long-range cortical signals, but usually lag behind CNNs. Adding intermediate mixing modules, inspired by cortical columns, closes that gap and even beats vanilla CNNs of similar size.',
        links: [
            { label: 'Read paper', href: 'https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2025.1692418/full' },
        ],
    },
    {
        imageSrc: './img/research/LC.png',
        title: 'BioLCNet: Reward-Modulated Locally Connected Spiking Neural Networks',
        venue: 'Machine Learning, Optimization, and Data Science (LOD 2022)',
        date: 'Mar 2023',
        text: 'A locally connected spiking neural network trained only with biologically plausible rules: unsupervised STDP for feature learning and reward-modulated STDP for decision making.',
        links: [
            { label: 'Read paper', href: 'https://link.springer.com/chapter/10.1007/978-3-031-25891-6_42' },
        ],
    },
    {
        imageSrc: './img/research/CSP figure.jpg',
        title: 'Towards real-world BCI: CCSPNet, a compact subject-independent motor imagery framework',
        venue: 'Digital Signal Processing',
        date: 'Mar 2023',
        text: 'A compact EEG decoder for motor-imagery brain-computer interfaces that combines convolutional feature extraction with common spatial patterns and generalizes to subjects it has never seen.',
        links: [
            { label: 'Read paper', href: 'https://www.sciencedirect.com/science/article/abs/pii/S105120042200433X' },
        ],
    },
    {
        imageSrc: './img/research/msc-dissertation.jpg',
        title: 'Bio-plausible Modeling of Associative Learning',
        venue: 'MSc Dissertation, University of Edinburgh',
        date: 'Sep 2022',
        tags: [{ label: 'MSc Thesis' }],
        text: 'A brain-inspired spiking network with reward-modulated plasticity that reproduces classical and operant conditioning. Along the way, I built FastSpike.jl, a GPU-accelerated spiking neural network simulator in Julia.',
        links: [
            { label: 'PDF', href: './files/MahbodNouri_MSc_Dissertation.pdf' },
            { label: 'FastSpike.jl', href: 'https://github.com/mahbodnr/FastSpike.jl' },
        ],
    },
];


const conferences = [
    {
        title: 'Bernstein Conference 2023',
        tags: [{ label: 'Poster' }],
        date: 'Sep 2023',
        text: 'Efficient learning of deep non-negative matrix factorization networks',
    },
    {
        title: '2nd Advanced Course & Symposium on Artificial Intelligence & Neuroscience (ACAIN 2022)',
        tags: [{ label: 'Oral presentation', style: 'accent' }],
        date: 'Sep 2022',
        text: 'BioLCNet: Reward-Modulated Locally Connected Spiking Neural Networks',
    },
];

const projects = [
    {
        imageSrc: './img/research/llmafia.jpg',
        title: 'LLMafia',
        date: '2025',
        text: 'Large language models playing Mafia (a.k.a. Werewolf) against each other: they discuss, accuse, bluff, and vote through day and night phases. Mix models from OpenAI, Anthropic, Google, or run local ones with Ollama, and watch the game unfold in a web UI.',
        links: [
            { label: 'GitHub', href: 'https://github.com/mahbodnr/LLMafia' },
        ],
    },
    {
        imageSrc: './img/research/recursive-vit.svg',
        title: 'Recursive Vision Transformers',
        venue: 'University of Bremen',
        date: '2024',
        text: 'A Vision Transformer with a single weight-tied block, applied over and over until its representation converges to a fixed point, so that depth is something the model computes rather than a number we fix in advance.',
        links: [
            { label: 'Read more', href: './research/recursive-transformer/' },
        ],
    },
    {
        imageSrc: './img/research/cough-cover.jpg',
        title: 'COVID-19 diagnosis from cough sounds',
        venue: 'University of Tehran',
        date: '2020',
        text: 'A deep learning model that screens for COVID-19 from crowd-sourced recordings of people coughing, developed during a research internship.',
    },
    {
        imageSrc: './img/research/mask-detection-cover.jpg',
        title: 'Mask detection',
        date: '2021',
        text: 'A real-time model that detects whether a person is wearing a face mask, and whether they are wearing it correctly, running on live video.',
        links: [
            { label: 'Read more', href: './research/mask-detection/' },
        ],
    },
    {
        imageSrc: './img/research/bsc/thumb.jpg',
        title: "Bachelor's Thesis: Deep Learning for Medical Image Segmentation",
        venue: 'University of Tehran',
        date: 'Sep 2020',
        text: 'Segmenting the lungs and COVID-19 infections in chest CT scans with fully convolutional networks: UNet, UNet++, and UNet++ with deep supervision.',
        links: [
            { label: 'Read more', href: './research/bachelor-thesis/' },
        ],
    },
];

function createResearchElement(research) {
    const researchElement = document.createElement('article');
    researchElement.classList.add('research-item');

    if (research.imageSrc) {
        const frameElement = document.createElement('div');
        frameElement.className = 'research-thumb';
        const imageElement = document.createElement('img');
        imageElement.src = research.imageSrc;
        imageElement.alt = research.title;
        imageElement.loading = 'lazy';
        frameElement.appendChild(imageElement);
        researchElement.appendChild(frameElement);
    } else {
        researchElement.classList.add('no-image');
    }

    const researchElementText = document.createElement('div');
    researchElementText.classList.add('research-text');
    researchElement.appendChild(researchElementText);

    const titleElement = document.createElement('h3');
    titleElement.textContent = research.title;
    researchElementText.appendChild(titleElement);

    const meta = [research.venue, research.date].filter(Boolean);
    if (meta.length || research.tags) {
        const metaElement = document.createElement('div');
        metaElement.className = 'research-meta';
        (research.tags || []).forEach(function (tag) {
            const tagElement = document.createElement('span');
            tagElement.className = 'research-tag' + (tag.style ? ' ' + tag.style : '');
            tagElement.textContent = tag.label;
            metaElement.appendChild(tagElement);
        });
        if (meta.length) {
            const metaText = document.createElement('span');
            metaText.textContent = meta.join(' · ');
            metaElement.appendChild(metaText);
        }
        researchElementText.appendChild(metaElement);
    }

    if (research.text) {
        const textElement = document.createElement('p');
        textElement.textContent = research.text;
        researchElementText.appendChild(textElement);
    }

    if (research.links) {
        const linksElement = document.createElement('div');
        linksElement.className = 'research-links';
        research.links.forEach(function (link) {
            const linkElement = document.createElement('a');
            linkElement.href = link.href;
            // Pages on this site open in place; papers, PDFs and repos open in a new tab
            if (/^https?:|\.pdf$/.test(link.href)) {
                linkElement.target = '_blank';
                linkElement.rel = 'noopener';
            }
            linkElement.textContent = link.label;
            linksElement.appendChild(linkElement);
        });
        researchElementText.appendChild(linksElement);
    }

    return researchElement;
}

function renderSections() {
    const sectionsContainer = document.querySelector('#research');
    const sections = [papers, conferences, projects];
    const labels = ["Selected Papers", "Conferences", "Projects"];

    for (var i = 0; i < labels.length; i++) {
        const sectionElement = document.createElement('section');
        sectionElement.className = 'research-section';

        const labelElement = document.createElement('h2');
        labelElement.textContent = labels[i];
        sectionElement.appendChild(labelElement);

        for (var j = 0; j < sections[i].length; j++) {
            sectionElement.appendChild(createResearchElement(sections[i][j]));
        }
        sectionsContainer.appendChild(sectionElement);
    }
}

renderSections();
