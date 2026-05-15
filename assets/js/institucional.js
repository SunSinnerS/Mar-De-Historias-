/* =========================================================
   Mar de Histórias — institucional
   Accordions e formulário de contato integrado à API
   ========================================================= */

(() => {
  'use strict';

  const page = document.body?.dataset.page || '';
  const statusBox = document.getElementById('institutionalStatus');

  const isValidEmail = (value = '') =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const apiRequest = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Não foi possível concluir a ação.');
    }

    return data;
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
    const submit = form.querySelector('[type="submit"]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearStatus();

      const nome = nameInput?.value.trim() || '';
      const email = emailInput?.value.trim() || '';
      const assunto = subjectInput?.value || '';
      const mensagem = messageInput?.value.trim() || '';

      if (nome.length < 2) {
        showStatus('Informe um nome válido para enviar a mensagem.');
        nameInput?.focus();
        return;
      }

      if (!isValidEmail(email)) {
        showStatus('Digite um e-mail válido para retorno.');
        emailInput?.focus();
        return;
      }

      if (!assunto) {
        showStatus('Selecione um assunto para a mensagem.');
        subjectInput?.focus();
        return;
      }

      if (mensagem.length < 12) {
        showStatus('Escreva uma mensagem com pelo menos 12 caracteres.');
        messageInput?.focus();
        return;
      }

      if (submit) {
        submit.disabled = true;
        submit.dataset.originalLabel = submit.innerHTML;
        submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
      }

      try {
        await apiRequest('/api/contato', {
          method: 'POST',
          body: JSON.stringify({
            nome,
            email,
            assunto,
            mensagem,
          }),
        });

        showStatus('Mensagem enviada e registrada no banco de dados.', 'success');

        window.MarDeHistorias?.showToast?.({
          title: 'Mensagem enviada',
          message: 'O contato foi salvo pelo backend da livraria.',
          icon: 'fa-solid fa-paper-plane',
        });

        form.reset();
      } catch (error) {
        showStatus(error.message);
        window.MarDeHistorias?.showToast?.({
          title: 'Falha no envio',
          message: error.message,
          icon: 'fa-solid fa-triangle-exclamation',
        });
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.innerHTML = submit.dataset.originalLabel || submit.innerHTML;
        }
      }
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    initAccordions();
    if (page === 'contato') initContactForm();
  });
})();
