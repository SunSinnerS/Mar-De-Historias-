/* =========================================================
   Mar de Histórias — institucional
   Accordions e formulário de contato funcional no protótipo
   ========================================================= */

(() => {
  'use strict';

  const CONTACT_KEY = 'marDeHistoriasMensagensContato';
  const page = document.body?.dataset.page || '';
  const statusBox = document.getElementById('institutionalStatus');

  const isValidEmail = (value = '') =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const readMessages = () => {
    try {
      return JSON.parse(localStorage.getItem(CONTACT_KEY)) || [];
    } catch (error) {
      return [];
    }
  };

  const saveMessages = (messages) => {
    localStorage.setItem(CONTACT_KEY, JSON.stringify(messages));
  };

  const showStatus = (message, type = 'error') => {
    if (!statusBox) return;
    statusBox.className = `institutional-status is-visible is-${type}`;
    statusBox.textContent = message;
  };

  const clearStatus = () => {
    if (!statusBox) return;
    statusBox.className = 'institutional-status';
    statusBox.textContent = '';
  };

  const initAccordions = () => {
    document.querySelectorAll('[data-accordion]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = button.closest('.accordion-item');
        if (!item) return;

        const willOpen = !item.classList.contains('is-open');

        item.parentElement?.querySelectorAll('.accordion-item').forEach((sibling) => {
          if (sibling !== item) {
            sibling.classList.remove('is-open');
          }
        });

        item.classList.toggle('is-open', willOpen);
      });
    });
  };

  const initContactForm = () => {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const nameInput = document.getElementById('contactName');
    const emailInput = document.getElementById('contactEmail');
    const subjectInput = document.getElementById('contactSubject');
    const messageInput = document.getElementById('contactMessage');

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearStatus();

      const name = nameInput?.value.trim() || '';
      const email = emailInput?.value.trim() || '';
      const subject = subjectInput?.value || '';
      const message = messageInput?.value.trim() || '';

      if (name.length < 2) {
        showStatus('Informe um nome válido para enviar a mensagem.');
        nameInput?.focus();
        return;
      }

      if (!isValidEmail(email)) {
        showStatus('Digite um e-mail válido para retorno.');
        emailInput?.focus();
        return;
      }

      if (!subject) {
        showStatus('Selecione um assunto para a mensagem.');
        subjectInput?.focus();
        return;
      }

      if (message.length < 12) {
        showStatus('Escreva uma mensagem com pelo menos 12 caracteres.');
        messageInput?.focus();
        return;
      }

      const messages = readMessages();
      messages.unshift({
        id: `msg-${Date.now()}`,
        name,
        email,
        subject,
        message,
        createdAt: new Date().toISOString(),
      });
      saveMessages(messages);

      showStatus('Mensagem registrada localmente. Obrigado por entrar em contato!', 'success');

      window.MarDeHistorias?.showToast?.({
        title: 'Mensagem enviada',
        message: 'O contato foi salvo neste navegador como parte do protótipo.',
        icon: 'fa-solid fa-paper-plane',
      });

      form.reset();
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    initAccordions();
    if (page === 'contato') initContactForm();
  });
})();
