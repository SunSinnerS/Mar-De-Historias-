/* =========================================================
   Mar de Histórias — autenticação front-end
   Login, cadastro e recuperação de senha para o protótipo
   ========================================================= */

(() => {
  'use strict';

  const USERS_KEY = 'marDeHistoriasUsuarios';
  const SESSION_KEY = 'marDeHistoriasSessao';

  const page = document.body?.dataset.page || '';
  const statusBox = document.getElementById('authStatus');

  const normalizeEmail = (value = '') => value.trim().toLowerCase();

  const isValidEmail = (value = '') =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const readUsers = () => {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch (error) {
      return [];
    }
  };

  const saveUsers = (users) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  };

  const getSession = () => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
    } catch (error) {
      return null;
    }
  };

  const saveSession = (user, remember = true) => {
    const session = {
      email: user.email,
      name: user.name,
      createdAt: new Date().toISOString(),
    };

    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);

    if (remember) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    window.MarDeHistorias?.refreshAccountArea?.();
  };

  const showStatus = (message, type = 'error') => {
    if (!statusBox) return;

    statusBox.className = `auth-status is-visible is-${type}`;
    statusBox.textContent = message;
  };

  const clearStatus = () => {
    if (!statusBox) return;
    statusBox.className = 'auth-status';
    statusBox.textContent = '';
  };

  const toast = ({ title, message, icon }) => {
    window.MarDeHistorias?.showToast?.({ title, message, icon });
  };

  const fallbackHash = (value = '') => {
    try {
      return btoa(unescape(encodeURIComponent(value)));
    } catch (error) {
      return value;
    }
  };

  const hashPassword = async (password = '') => {
    if (window.crypto?.subtle && window.TextEncoder) {
      const encoded = new TextEncoder().encode(password);
      const buffer = await window.crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }

    return fallbackHash(password);
  };

  const getRedirect = () => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    return redirect && !redirect.includes('://') ? redirect : 'index.html';
  };

  const setButtonLoading = (button, isLoading, label) => {
    if (!button) return;

    if (isLoading) {
      button.dataset.originalLabel = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${label}`;
      return;
    }

    button.disabled = false;
    button.innerHTML = button.dataset.originalLabel || button.innerHTML;
  };

  const initPasswordToggles = () => {
    document.querySelectorAll('[data-toggle-password]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.togglePassword);
        const icon = button.querySelector('i');
        if (!input) return;

        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        button.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');

        if (icon) {
          icon.className = showing ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
        }
      });
    });
  };

  const initLogin = () => {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearStatus();

      const email = normalizeEmail(document.getElementById('loginEmail')?.value || '');
      const password = document.getElementById('loginPassword')?.value || '';
      const remember = Boolean(document.getElementById('rememberSession')?.checked);
      const submit = form.querySelector('[type="submit"]');

      if (!isValidEmail(email)) {
        showStatus('Digite um e-mail válido para entrar.');
        document.getElementById('loginEmail')?.focus();
        return;
      }

      if (!password) {
        showStatus('Digite sua senha para continuar.');
        document.getElementById('loginPassword')?.focus();
        return;
      }

      setButtonLoading(submit, true, 'Entrando...');

      const users = readUsers();
      const user = users.find((item) => item.email === email);
      const passwordHash = await hashPassword(password);

      if (!user || user.passwordHash !== passwordHash) {
        setButtonLoading(submit, false);
        showStatus('E-mail ou senha incorretos. Verifique os dados ou crie uma conta.');
        toast({
          title: 'Não foi possível entrar',
          message: 'Confira o e-mail e a senha informados.',
          icon: 'fa-solid fa-triangle-exclamation',
        });
        return;
      }

      saveSession(user, remember);
      showStatus(`Entrada confirmada. Bem-vindo, ${user.name.split(' ')[0]}!`, 'success');
      toast({
        title: 'Login realizado',
        message: `Olá, ${user.name.split(' ')[0]}. Sua conta está ativa.`,
        icon: 'fa-solid fa-circle-check',
      });

      window.setTimeout(() => {
        window.location.href = getRedirect();
      }, 900);
    });
  };

  const initRegister = () => {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearStatus();

      const name = document.getElementById('registerName')?.value.trim() || '';
      const lastName = document.getElementById('registerLastName')?.value.trim() || '';
      const email = normalizeEmail(document.getElementById('registerEmail')?.value || '');
      const password = document.getElementById('registerPassword')?.value || '';
      const confirmPassword = document.getElementById('registerConfirmPassword')?.value || '';
      const acceptTerms = Boolean(document.getElementById('acceptTerms')?.checked);
      const newsletter = Boolean(document.getElementById('subscribeNewsletter')?.checked);
      const submit = form.querySelector('[type="submit"]');

      if (name.length < 2) {
        showStatus('Informe um nome válido para criar a conta.');
        document.getElementById('registerName')?.focus();
        return;
      }

      if (!isValidEmail(email)) {
        showStatus('Digite um e-mail válido para o cadastro.');
        document.getElementById('registerEmail')?.focus();
        return;
      }

      if (password.length < 8) {
        showStatus('A senha precisa ter pelo menos 8 caracteres.');
        document.getElementById('registerPassword')?.focus();
        return;
      }

      if (password !== confirmPassword) {
        showStatus('As senhas não coincidem. Revise a confirmação.');
        document.getElementById('registerConfirmPassword')?.focus();
        return;
      }

      if (!acceptTerms) {
        showStatus('Aceite os termos do protótipo para continuar.');
        document.getElementById('acceptTerms')?.focus();
        return;
      }

      const users = readUsers();
      if (users.some((user) => user.email === email)) {
        showStatus('Já existe uma conta cadastrada com este e-mail.');
        toast({
          title: 'E-mail já cadastrado',
          message: 'Faça login ou use a recuperação de senha.',
          icon: 'fa-solid fa-triangle-exclamation',
        });
        return;
      }

      setButtonLoading(submit, true, 'Criando conta...');

      const passwordHash = await hashPassword(password);
      const fullName = [name, lastName].filter(Boolean).join(' ');

      const user = {
        id: `user-${Date.now()}`,
        name: fullName,
        email,
        passwordHash,
        newsletter,
        createdAt: new Date().toISOString(),
      };

      users.push(user);
      saveUsers(users);
      saveSession(user, true);

      showStatus(`Conta criada com sucesso. Bem-vindo, ${name}!`, 'success');
      toast({
        title: 'Cadastro concluído',
        message: 'Sua conta da Mar de Histórias foi criada.',
        icon: 'fa-solid fa-user-check',
      });

      window.setTimeout(() => {
        window.location.href = getRedirect();
      }, 950);
    });
  };

  const initRecovery = () => {
    const emailForm = document.getElementById('recoveryEmailForm');
    const passwordForm = document.getElementById('recoveryPasswordForm');
    const emailLabel = document.getElementById('recoveryEmailLabel');

    if (!emailForm || !passwordForm) return;

    let recoveryEmail = '';

    emailForm.addEventListener('submit', (event) => {
      event.preventDefault();
      clearStatus();

      const email = normalizeEmail(document.getElementById('recoveryEmail')?.value || '');

      if (!isValidEmail(email)) {
        showStatus('Digite um e-mail válido para localizar o cadastro.');
        document.getElementById('recoveryEmail')?.focus();
        return;
      }

      const users = readUsers();
      const user = users.find((item) => item.email === email);

      if (!user) {
        showStatus('Não encontramos uma conta com este e-mail.');
        toast({
          title: 'Cadastro não localizado',
          message: 'Crie uma conta ou confira o endereço digitado.',
          icon: 'fa-solid fa-triangle-exclamation',
        });
        return;
      }

      recoveryEmail = email;
      emailForm.hidden = true;
      passwordForm.hidden = false;

      if (emailLabel) {
        emailLabel.textContent = email;
      }

      showStatus('Cadastro localizado. Agora defina uma nova senha.', 'success');
    });

    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearStatus();

      const password = document.getElementById('recoveryPassword')?.value || '';
      const confirmPassword = document.getElementById('recoveryConfirmPassword')?.value || '';
      const submit = passwordForm.querySelector('[type="submit"]');

      if (password.length < 8) {
        showStatus('A nova senha precisa ter pelo menos 8 caracteres.');
        document.getElementById('recoveryPassword')?.focus();
        return;
      }

      if (password !== confirmPassword) {
        showStatus('As senhas não coincidem. Revise a confirmação.');
        document.getElementById('recoveryConfirmPassword')?.focus();
        return;
      }

      const users = readUsers();
      const userIndex = users.findIndex((user) => user.email === recoveryEmail);

      if (userIndex < 0) {
        showStatus('O cadastro não pôde ser atualizado. Reinicie a recuperação.');
        return;
      }

      setButtonLoading(submit, true, 'Salvando...');

      users[userIndex].passwordHash = await hashPassword(password);
      users[userIndex].updatedAt = new Date().toISOString();
      saveUsers(users);

      showStatus('Senha atualizada com sucesso. Redirecionando para o login...', 'success');
      toast({
        title: 'Senha redefinida',
        message: 'Entre novamente usando a nova senha.',
        icon: 'fa-solid fa-key',
      });

      window.setTimeout(() => {
        window.location.href = 'login.html';
      }, 1100);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    initPasswordToggles();

    if (page === 'login') initLogin();
    if (page === 'cadastro') initRegister();
    if (page === 'recuperar-senha') initRecovery();
  });
})();
