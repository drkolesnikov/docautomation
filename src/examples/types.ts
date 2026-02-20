export interface Example {
  id: string;
  input: string;
  output: string;
  tokenEstimate: number;
  metadata: {
    diagnosis_category?: string;
    complexity?: 'simple' | 'typical' | 'complex';
  };
}
