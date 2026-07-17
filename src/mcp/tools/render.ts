import path from 'path';
import os from 'os';

export async function handleRender(args: {
  json_data: string;
  template?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const data = JSON.parse(args.json_data);
    const outputPath = path.join(os.tmpdir(), `lens-render-${Date.now()}.pdf`);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'not_implemented',
          message: 'Typst rendering requires Typst binary. Use `typst compile` externally.',
          data,
          template: args.template ?? 'modern',
          suggested_output: outputPath,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }),
      }],
    };
  }
}
