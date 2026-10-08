// Onboarding R1 §8.15. Komponen ini tidak menyimpan preference sendiri;
// app yang memutuskan first-run, template, locale, dan keymap melalui callback.

import { el } from './dom.js';
import { Button, Dialog } from './kit.js';

export function createWelcome({
  t,
  initialLocale = 'id',
  initialKeymap = 'songwriter',
  initialTemplate = 'pop-4-4',
  onSubmit,
  onSkip,
}) {
  const locale = el('select', {
    dataset: { action: 'welcome-locale' },
    'aria-label': t('welcome.language'),
  }, [
    el('option', { value: 'id', text: 'Indonesia' }),
    el('option', { value: 'en', text: 'English' }),
  ]);
  locale.value = initialLocale;

  const keymap = el('select', {
    dataset: { action: 'welcome-keymap' },
    'aria-label': t('welcome.keymap'),
  }, [
    el('option', { value: 'songwriter', text: t('welcome.keymapSongwriter') }),
    el('option', { value: 'openmpt', text: t('welcome.keymapOpenMpt') }),
  ]);
  keymap.value = initialKeymap;

  const template = el('select', {
    dataset: { action: 'welcome-template' },
    'aria-label': t('welcome.template'),
  }, [
    el('option', { value: 'blank', text: t('template.blank') }),
    el('option', { value: 'pop-4-4', text: t('template.pop44') }),
    el('option', { value: 'learning-song', text: t('template.learningSong') }),
  ]);
  template.value = initialTemplate;

  const templateHint = el('p', {
    class: 'welcome__lead',
    dataset: { action: 'welcome-template-hint' },
  });
  function updateTemplateHint() {
    templateHint.textContent = t(template.value === 'learning-song'
      ? 'welcome.learningSongHint'
      : 'welcome.templateHint');
  }
  template.addEventListener('change', updateTemplateHint);
  updateTemplateHint();

  const body = el('div', { class: 'welcome', dataset: { action: 'welcome' } }, [
    el('p', { class: 'welcome__lead', text: t('welcome.lead') }),
    field(t('welcome.language'), locale),
    field(t('welcome.keymap'), keymap),
    field(t('welcome.template'), template),
    templateHint,
  ]);

  let dialog;
  const skip = Button({
    label: t('welcome.skip'),
    variant: 'ghost',
    onClick: () => {
      onSkip?.();
      dialog.close();
    },
  });
  skip.dataset.action = 'welcome-skip';

  const start = Button({
    label: t('welcome.start'),
    onClick: () => {
      onSubmit?.({
        locale: locale.value,
        keymap: keymap.value,
        templateId: template.value,
      });
      dialog.close();
    },
  });
  start.dataset.action = 'welcome-start';

  dialog = Dialog({
    title: t('welcome.title'),
    body,
    actions: [skip, start],
  });
  dialog.dataset.action = 'welcome-dialog';

  return {
    open: (trigger = null) => dialog.open(trigger),
    close: () => dialog.close(),
    isOpen: () => dialog.isOpen(),
    element: dialog,
  };
}

function field(label, control) {
  return el('label', { class: 'welcome__field' }, [
    el('span', { class: 'welcome__label', text: label }),
    control,
  ]);
}
