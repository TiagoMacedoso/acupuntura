let database = [];
const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearBtn');
const resultsContainer = document.getElementById('resultsContainer');
const loadingState = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const noResultsState = document.getElementById('noResults');
const statsBar = document.getElementById('statsBar');
const resultCountSpan = document.getElementById('resultCount');

// Tabs e Views
const tabSearch = document.getElementById('tabSearch');
const tabBrowse = document.getElementById('tabBrowse');
const searchView = document.getElementById('searchView');
const browseView = document.getElementById('browseView');
const searchBoxContainer = document.getElementById('searchBoxContainer');
const modulesContainer = document.getElementById('modulesContainer');

// Remove acentos para busca flexível
const normalizeString = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// Carrega o banco JS (já embutido no HTML)
function loadDatabase() {
    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
        
    // Como trocamos o arquivo compilado de .json para .js (exportando a constante window.dataBaseAulas),
    // ele carrega magicamente mesmo dando clique-duplo no arquivo (sem erro de CORS de servidor).
    if (typeof window.dataBaseAulas !== 'undefined' && window.dataBaseAulas.length > 0) {
        database = window.dataBaseAulas;
        loadingState.style.display = 'none';
        emptyState.style.display = 'block';
        searchInput.focus();
        
        // Renderiza a view de navegação em background
        renderBrowseView();
    } else {
        console.error("Database não encontrada no objeto window.");
        loadingState.innerHTML = `
            <div class="icon-circle" style="color: #ef4444;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <h3>Base de dados vazia ou ainda não gerada</h3>
            <p>Rode o script <code>python build_site_index.py</code> na pasta principal para criá-la!</p>
        `;
    }
}

// Formata o trecho destacando os termos buscados
function highlightText(text, searchWords) {
    if (!searchWords || searchWords.length === 0) return text;
    
    let result = text;
    
    // Função auxiliar para regex ignorando acentos nativamente
    const createAccentRegex = (word) => {
        return word
            .replace(/[aáàâã]/g, '[aáàâã]')
            .replace(/[eéèê]/g, '[eéèê]')
            .replace(/[iíìî]/g, '[iíìî]')
            .replace(/[oóòôõ]/g, '[oóòôõ]')
            .replace(/[uúùû]/g, '[uúùû]')
            .replace(/[cç]/g, '[cç]');
    };
    
    // Ordenar palavras por tamanho (maiores primeiro evita sobrescrever pedaços de dentro)
    const sortedWords = [...searchWords].sort((a, b) => b.length - a.length);
    
    sortedWords.forEach(word => {
        if (word.length < 2) return; // Ignora letrinhas e preposições curtas para não colorir tudo
        
        const pattern = createAccentRegex(word);
        
        // Regex com lookahead para não substituir algo que já está dentro de uma tag <mark> (graças ao > no final da tag css)
        const regex = new RegExp(`(${pattern})(?![^<]*>)`, 'gi');
        result = result.replace(regex, '<mark>$1</mark>');
    });
    
    return result;
}

// Exibe os resultados
function renderResults(results, searchWords) {
    resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
        statsBar.style.display = 'none';
        noResultsState.style.display = 'block';
        return;
    }
    
    noResultsState.style.display = 'none';
    statsBar.style.display = 'flex';
    resultCountSpan.textContent = `${results.length} trecho${results.length > 1 ? 's' : ''} encontrado${results.length > 1 ? 's' : ''}`;
    
    results.forEach(res => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.onclick = () => openModal(res.modulo, res.aula, res.time, searchWords);
        
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <span class="module-badge">${res.modulo}</span>
                    <h2 class="aula-title">${res.aula}</h2>
                </div>
                <div class="time-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Aos ${res.time}
                </div>
            </div>
            <div class="match-snippet">
                "...${highlightText(res.text, searchWords)}..."
            </div>
        `;
        
        resultsContainer.appendChild(card);
    });
}

// Executa a busca
function performSearch() {
    const rawTerm = searchInput.value.trim();
    const normalizedQuery = normalizeString(rawTerm);
    const searchWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
    
    // Mostra/esconde o botão de limpar X
    if (rawTerm.length > 0) {
        clearBtn.classList.add('visible');
    } else {
        clearBtn.classList.remove('visible');
    }
    
    if (searchWords.length === 0 || searchWords[0].length < 2) {
        // Volta ao estado vazio se tiver poucas letras
        resultsContainer.innerHTML = '';
        statsBar.style.display = 'none';
        noResultsState.style.display = 'none';
        if (searchWords.length === 0) {
            emptyState.style.display = 'block';
        }
        return;
    }
    
    emptyState.style.display = 'none';
    
    const matches = [];
    
    // Percorre o DB inteiro
    database.forEach(item => {
        item.trechos.forEach(trecho => {
            const normalizedTrecho = normalizeString(trecho.text);
            
            // Busca Multi-palavras (Contextual AND): Verifica se TODAS as palavras digitadas estão no MESMO trecho (parágrafo).
            const hasAllWords = searchWords.every(word => normalizedTrecho.includes(word));
            
            if (hasAllWords) {
                matches.push({
                    modulo: item.modulo,
                    aula: item.aula,
                    time: trecho.time,
                    text: trecho.text
                });
            }
        });
    });
    
    // Limita resultados para não travar a UI
    renderResults(matches.slice(0, 100), searchWords);
}

// Listeners
searchInput.addEventListener('input', performSearch);

clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    performSearch();
    searchInput.focus();
});

// Lógica das Abas
function switchTab(tab) {
    if (tab === 'search') {
        tabSearch.classList.add('active');
        tabBrowse.classList.remove('active');
        searchView.style.display = 'block';
        browseView.style.display = 'none';
        searchBoxContainer.style.display = 'flex';
        searchInput.focus();
    } else {
        tabBrowse.classList.add('active');
        tabSearch.classList.remove('active');
        browseView.style.display = 'block';
        searchView.style.display = 'none';
        searchBoxContainer.style.display = 'none';
    }
}

tabSearch.addEventListener('click', () => switchTab('search'));
tabBrowse.addEventListener('click', () => switchTab('browse'));

// Renderização da view Explorar
function renderBrowseView() {
    modulesContainer.innerHTML = '';
    
    // Agrupar por modulos únicos
    const modulosMap = new Map();
    
    database.forEach(item => {
        if (!modulosMap.has(item.modulo)) {
            modulosMap.set(item.modulo, []);
        }
        // Evita a duplicação se tivessem várias entradas para mesma aula (o que o DB novo tenta evitar, mas previne)
        if (!modulosMap.get(item.modulo).includes(item.aula)) {
            modulosMap.get(item.modulo).push(item.aula);
        }
    });
    
    // Ordenar Módulos (se tiverem números no começo)
    const modulosSort = Array.from(modulosMap.keys()).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
    
    modulosSort.forEach(moduloNome => {
        const aulas = modulosMap.get(moduloNome).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        
        const modElement = document.createElement('div');
        modElement.className = 'module-box';
        
        // Criar a lista de aulas HTML
        let aulasHtml = '<ul class="lessons-list">';
        aulas.forEach(aula => {
            // Repare que passamos um array vazio [] para searchWords pois estamos apenas abrindo para ler
            // E null para focusTime
            aulasHtml += `
                <li class="lesson-item" onclick="openModal('${moduloNome.replace(/'/g, "\\'")}', '${aula.replace(/'/g, "\\'")}', null, [])">
                    <svg class="lesson-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    ${aula}
                </li>
            `;
        });
        aulasHtml += '</ul>';
        
        modElement.innerHTML = `
            <div class="module-box-header">${moduloNome}</div>
            ${aulasHtml}
        `;
        
        modulesContainer.appendChild(modElement);
    });
}

// Lógica do Modal
const modalOverlay = document.getElementById('fullTextModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalTextBody = document.getElementById('modalTextBody');
const modalSearchInput = document.getElementById('modalSearchInput');

let currentModalItem = null;

function renderModalContent(item, searchWords, focusTime = null) {
    let html = '';
    let firstMatchIdAssigned = false;

    item.trechos.forEach(t => {
        // Realça TODAS as palavras buscadas neste parágrafo
        const highlightedText = highlightText(t.text, searchWords);
        
        let rowId = '';
        let bgClass = '';
        
        // Se temos palavras buscadas e houve um match real no highlight (tem tag mark)
        if (searchWords && searchWords.length > 0 && highlightedText.includes('<mark>')) {
             bgClass = 'highlight-text';
             
             // Se clicou no card global com um tempo específico
             if (focusTime && t.time === focusTime) {
                 rowId = 'id="focus-line"';
                 firstMatchIdAssigned = true;
             } 
             // Se é busca local (digitando direto no modal sem focusTime exato), scrollar pro PRIMEIRO match da página
             else if (!focusTime && !firstMatchIdAssigned) {
                 rowId = 'id="focus-line"';
                 firstMatchIdAssigned = true;
             }
        }

        // O texto inteiro flui como parágrafo (p) mas o clique-alvo fica amarelão e com id foco
        html += `
            <p class="transcript-paragraph">
                <span class="transcript-time">[${t.time}]</span> 
                <span ${rowId} class="${bgClass}">${highlightedText}</span>
            </p>
        `;
    });

    modalTextBody.innerHTML = html;
}

function scrollToFocus() {
    setTimeout(() => {
        const focusEl = document.getElementById('focus-line');
        if (focusEl) {
            focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function openModal(modulo, aula, focusTime, searchWords) {
    // 1. Achar a aula inteira no bd
    const item = database.find(d => d.modulo === modulo && d.aula === aula);
    if (!item) return;
    
    currentModalItem = item;

    // 2. Preencher o cabeçalho
    document.getElementById('modalModule').textContent = modulo;
    document.getElementById('modalAulaTitle').textContent = aula;
    
    // Configura texto do search local se viemos de uma global
    if (searchWords && searchWords.length > 0) {
        modalSearchInput.value = searchWords.join(' ');
    } else {
        modalSearchInput.value = '';
    }

    // 3. Montar o texto completo dinamicamente
    renderModalContent(item, searchWords, focusTime);

    modalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Impede rolar a tela do fundo

    // 4. Scrollar pro trecho da busca
    scrollToFocus();
}

function closeModal() {
    modalOverlay.style.display = 'none';
    document.body.style.overflow = 'auto'; // Volta a rolagem do fundo
    currentModalItem = null;
    modalSearchInput.value = '';
}

// Evento de digitação na busca RÁPIDA DE DENTRO DO MODAL
modalSearchInput.addEventListener('input', (e) => {
    if (!currentModalItem) return;
    
    const rawVal = e.target.value.trim();
    const normalizedQuery = normalizeString(rawVal);
    const searchWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
    
    // Renderiza a parte de dentro passando false pro focusTime pra ele pular pro primeiro hit
    // E só joga searchWords local
    if (searchWords.length > 0 || rawVal === '') {
        renderModalContent(currentModalItem, searchWords, null);
        
        // Só rola a tela se escreveu algo. Se apagou não rola
        if (searchWords.length > 0) {
            scrollToFocus();
        }
    }
});

closeModalBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    // Fecha se clicar fora da janelinha (no fundão escuro)
    if (e.target === modalOverlay) {
        closeModal();
    }
});

// Init
document.addEventListener('DOMContentLoaded', loadDatabase);
