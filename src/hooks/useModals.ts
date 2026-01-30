import { useState, useCallback } from 'react';
import type { Person } from '../types';

interface ModalState {
  showPersonForm: boolean;
  editingPerson: Person | undefined;
  showSearch: boolean;
  showQuickTask: boolean;
  showQuickPrayer: boolean;
  showQuickNote: boolean;
  showQuickDonation: boolean;
  quickDonationPersonId: string | undefined;
  showEmailSidebar: boolean;
  emailRecipients: string[];
  emailGroupId: string | undefined;
}

const INITIAL_STATE: ModalState = {
  showPersonForm: false,
  editingPerson: undefined,
  showSearch: false,
  showQuickTask: false,
  showQuickPrayer: false,
  showQuickNote: false,
  showQuickDonation: false,
  quickDonationPersonId: undefined,
  showEmailSidebar: false,
  emailRecipients: [],
  emailGroupId: undefined,
};

export function useModals() {
  const [state, setState] = useState<ModalState>(INITIAL_STATE);

  const openPersonForm = useCallback((person?: Person) => {
    setState((prev) => ({ ...prev, showPersonForm: true, editingPerson: person }));
  }, []);

  const closePersonForm = useCallback(() => {
    setState((prev) => ({ ...prev, showPersonForm: false, editingPerson: undefined }));
  }, []);

  const openSearch = useCallback(() => {
    setState((prev) => ({ ...prev, showSearch: true }));
  }, []);

  const closeSearch = useCallback(() => {
    setState((prev) => ({ ...prev, showSearch: false }));
  }, []);

  const openQuickTask = useCallback(() => {
    setState((prev) => ({ ...prev, showQuickTask: true }));
  }, []);

  const closeQuickTask = useCallback(() => {
    setState((prev) => ({ ...prev, showQuickTask: false }));
  }, []);

  const openQuickPrayer = useCallback(() => {
    setState((prev) => ({ ...prev, showQuickPrayer: true }));
  }, []);

  const closeQuickPrayer = useCallback(() => {
    setState((prev) => ({ ...prev, showQuickPrayer: false }));
  }, []);

  const openQuickNote = useCallback(() => {
    setState((prev) => ({ ...prev, showQuickNote: true }));
  }, []);

  const closeQuickNote = useCallback(() => {
    setState((prev) => ({ ...prev, showQuickNote: false }));
  }, []);

  const openQuickDonation = useCallback((personId?: string) => {
    setState((prev) => ({
      ...prev,
      showQuickDonation: true,
      quickDonationPersonId: personId,
    }));
  }, []);

  const closeQuickDonation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showQuickDonation: false,
      quickDonationPersonId: undefined,
    }));
  }, []);

  const openEmailSidebar = useCallback((recipients?: string[], groupId?: string) => {
    setState((prev) => ({
      ...prev,
      showEmailSidebar: true,
      emailRecipients: recipients || [],
      emailGroupId: groupId,
    }));
  }, []);

  const closeEmailSidebar = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showEmailSidebar: false,
      emailRecipients: [],
      emailGroupId: undefined,
    }));
  }, []);

  const closeAll = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    // State
    showPersonForm: state.showPersonForm,
    editingPerson: state.editingPerson,
    showSearch: state.showSearch,
    showQuickTask: state.showQuickTask,
    showQuickPrayer: state.showQuickPrayer,
    showQuickNote: state.showQuickNote,
    showQuickDonation: state.showQuickDonation,
    quickDonationPersonId: state.quickDonationPersonId,
    showEmailSidebar: state.showEmailSidebar,
    emailRecipients: state.emailRecipients,
    emailGroupId: state.emailGroupId,
    // Actions
    openPersonForm,
    closePersonForm,
    openSearch,
    closeSearch,
    openQuickTask,
    closeQuickTask,
    openQuickPrayer,
    closeQuickPrayer,
    openQuickNote,
    closeQuickNote,
    openQuickDonation,
    closeQuickDonation,
    openEmailSidebar,
    closeEmailSidebar,
    closeAll,
  };
}
