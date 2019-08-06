import 'whatwg-fetch';
import gh from 'github-url-to-object';

import {
  supportedLanguages,
  supportedTools,
  getToolboxURN,
  USAGE_THRESHOLD,
  HUNDRED_PERCENT,
  MAX_DECIMALS,
  MIN_VALID_HTTP_STATUS,
  MAX_VALID_HTTP_STATUS,
  DEFAULT_LANGUAGE,
  DEFAULT_LANGUAGE_SET
} from './common';

const appendNode = document.querySelector('.file-navigation');
const githubInfo = gh(window.location.toString(), {enterprise: true});

function selectTools(langs) {
  const overallPoints = Object.keys(langs).
    map(lang => langs[lang]).
    reduce((overall, current) => overall + current, 0);

  const filterLang = lang =>
    supportedLanguages[lang.toLowerCase()] && langs[lang] / overallPoints > USAGE_THRESHOLD;

  const selectedTools = Object.keys(langs).
    filter(filterLang).
    reduce((acc, lang) => {
      acc.push(...supportedLanguages[lang.toLowerCase()]);
      return acc;
    }, []);

  return selectedTools.length > 0 ? Array.from(new Set(selectedTools)) : supportedLanguages[DEFAULT_LANGUAGE];
}

function renderButtons(tools) {
  const buttonGroup = document.createElement('div');
  const cloneUrl = `git@github.com:${githubInfo.user}/${githubInfo.repo}.git`;

  tools.
    sort().
    map(toolId => supportedTools[toolId]).
    forEach(tool => {
      const btn = document.createElement('a');
      btn.setAttribute('class', 'btn btn-sm tooltipped tooltipped-s tooltipped-multiline BtnGroup-item');
      btn.setAttribute('href', getToolboxURN(tool.tag, cloneUrl));
      btn.setAttribute('aria-label', `Open in ${tool.name}`);
      btn.innerHTML =
        `<img alt="${tool.name}" src="${tool.icon}" width="16" height="16" style="vertical-align: text-top;">`;

      buttonGroup.appendChild(btn);
    });

  buttonGroup.classList.add('BtnGroup');
  buttonGroup.classList.add('float-right');
  appendNode.appendChild(buttonGroup);
}

function extractLanguagesFromPage() {
  return new Promise(resolve => {
    const langElements = document.querySelectorAll('.repository-lang-stats-numbers .lang');
    if (langElements.length === 0) {
      resolve(DEFAULT_LANGUAGE_SET);
    } else {
      const allLangs = Array.from(langElements).reduce((acc, langEl) => {
        const percentEl = langEl.nextElementSibling;
        acc[langEl.textContent] = percentEl ? parseFloat(percentEl.textContent) : USAGE_THRESHOLD + 1;
        return acc;
      }, {});
      resolve(allLangs);
    }
  });
}

function checkStatus(response) {
  if (response.status >= MIN_VALID_HTTP_STATUS && response.status <= MAX_VALID_HTTP_STATUS) {
    return response;
  } else {
    const error = new Error(response.statusText);
    error.response = response;
    throw error;
  }
}

function parseResponse(response) {
  return new Promise((resolve, reject) => {
    response.json().
      then(result => {
        if (Object.keys(result).length > 0) {
          resolve(result);
        } else {
          reject();
        }
      }).catch(() => {
        reject();
      });
  });
}

function convertBytesToPercents(langs) {
  const totalBytes = Object.keys(langs).reduce((acc, lang) => acc + langs[lang], 0);
  Object.keys(langs).forEach(lang => {
    const percentFloat = langs[lang] / totalBytes * HUNDRED_PERCENT;
    const percentString = percentFloat.toFixed(MAX_DECIMALS);
    langs[lang] = parseFloat(percentString);
  });
  return langs;
}

function fetchLanguages() {
  const languagesUrl = `${githubInfo.api_url}/languages`;
  return new Promise(resolve => {
    fetch(languagesUrl).
      then(checkStatus).
      then(parseResponse).
      then(convertBytesToPercents).
      then(langs => {
        resolve(langs);
      }).
      catch(() => {
        extractLanguagesFromPage().then(langs => {
          resolve(langs);
        });
      });
  });
}

if (appendNode && githubInfo) {
  fetchLanguages().
    then(selectTools).
    then(renderButtons);
}
