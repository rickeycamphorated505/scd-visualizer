import { useState } from 'react';
import type { Dispatch } from 'react';
import type { ParseErrorInfo, SclModel } from '../model/types';
import type { UiAction } from './uiStore';

interface ParsedResult {
  error?: ParseErrorInfo;
  model?: SclModel;
}

interface UseSclFilesResult {
  fileName: string;
  model: SclModel | undefined;
  baselineModel: SclModel | undefined;
  baselineName: string;
  newModel: SclModel | undefined;
  newName: string;
  error: ParseErrorInfo | undefined;
  applyParsedMain: (result: ParsedResult, name: string) => void;
  applyParsedBaseline: (result: ParsedResult, name: string, onResetCompare: () => void) => void;
  applyParsedNew: (result: ParsedResult, name: string, onResetCompare: () => void) => void;
}

export function useSclFiles(uiDispatch: Dispatch<UiAction>): UseSclFilesResult {
  const [fileName, setFileName] = useState<string>('');
  const [model, setModel] = useState<SclModel | undefined>();
  const [baselineModel, setBaselineModel] = useState<SclModel | undefined>();
  const [baselineName, setBaselineName] = useState('');
  const [newModel, setNewModel] = useState<SclModel | undefined>();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<ParseErrorInfo | undefined>();

  function applyParsedMain(result: ParsedResult, name: string): void {
    setFileName(name);

    if (result.error) {
      setError(result.error);
      setModel(undefined);
      uiDispatch({ type: 'reset-for-file' });
      return;
    }

    setError(undefined);
    setModel(result.model);
    const defaultFocusIed = result.model?.ieds[0]?.name || null;
    uiDispatch({ type: 'reset-for-file', payload: { defaultFocusIed } });
  }

  function applyParsedBaseline(result: ParsedResult, name: string, onResetCompare: () => void): void {
    if (result.error) {
      setError(result.error);
      return;
    }
    setBaselineName(name);
    setBaselineModel(result.model);
    onResetCompare();
  }

  function applyParsedNew(result: ParsedResult, name: string, onResetCompare: () => void): void {
    if (result.error) {
      setError(result.error);
      return;
    }
    setNewName(name);
    setNewModel(result.model);
    setModel(result.model);
    onResetCompare();
    const defaultFocusIed = result.model?.ieds[0]?.name || null;
    uiDispatch({ type: 'reset-for-file', payload: { defaultFocusIed } });
  }

  return {
    fileName,
    model,
    baselineModel,
    baselineName,
    newModel,
    newName,
    error,
    applyParsedMain,
    applyParsedBaseline,
    applyParsedNew,
  };
}

