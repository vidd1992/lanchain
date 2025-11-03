/**
 * Callbacks de LangChain para debug y logging detallado
 *
 * Este módulo configura los callbacks que LangChain usa para mostrar
 * información detallada sobre las operaciones internas
 */

export class LangChainDebugCallbacks {
  constructor(enabled = false) {
    this.enabled = enabled;
  }

  /**
   * Obtener los callbacks de LangChain
   * @returns {Array} Array de callbacks
   */
  getCallbacks() {
    if (!this.enabled) {
      return [];
    }

    return [
      {
        handleLLMStart: async (llm, prompts) => {
          console.log('\n🔵 [LangChain LLM Start]');
          console.log(`   Model: ${llm.id || llm.name || 'Unknown'}`);
          console.log(`   Prompts: ${prompts.length}`);
          if (prompts.length > 0) {
            console.log(`   First prompt preview: ${prompts[0].substring(0, 100)}...`);
          }
        },

        handleLLMEnd: async (output) => {
          console.log('\n🟢 [LangChain LLM End]');
          if (output.generations && output.generations.length > 0) {
            const firstGen = output.generations[0][0];
            if (firstGen.text) {
              console.log(`   Response: ${firstGen.text.substring(0, 100)}...`);
            }
            if (firstGen.generationInfo) {
              console.log(`   Token usage:`, firstGen.generationInfo);
            }
          }
          if (output.llmOutput) {
            console.log(`   LLM Output:`, output.llmOutput);
          }
        },

        handleLLMError: async (err) => {
          console.error('\n🔴 [LangChain LLM Error]');
          console.error(`   Error: ${err.message}`);
        },

        handleChainStart: async (chain, inputs) => {
          console.log('\n⛓️  [LangChain Chain Start]');
          console.log(`   Chain: ${chain.id || chain.name || 'Unknown'}`);
          console.log(`   Inputs:`, inputs);
        },

        handleChainEnd: async (outputs) => {
          console.log('\n✅ [LangChain Chain End]');
          console.log(`   Outputs:`, outputs);
        },

        handleChainError: async (err) => {
          console.error('\n❌ [LangChain Chain Error]');
          console.error(`   Error: ${err.message}`);
        },

        handleToolStart: async (tool, input) => {
          console.log('\n🔧 [LangChain Tool Start]');
          console.log(`   Tool: ${tool.name}`);
          console.log(`   Input: ${input}`);
        },

        handleToolEnd: async (output) => {
          console.log('\n✅ [LangChain Tool End]');
          console.log(`   Output: ${output}`);
        },

        handleToolError: async (err) => {
          console.error('\n❌ [LangChain Tool Error]');
          console.error(`   Error: ${err.message}`);
        },

        handleText: async (text) => {
          console.log('\n📄 [LangChain Text]');
          console.log(`   ${text}`);
        },

        handleAgentAction: async (action) => {
          console.log('\n🤖 [LangChain Agent Action]');
          console.log(`   Tool: ${action.tool}`);
          console.log(`   Tool Input: ${action.toolInput}`);
          console.log(`   Log: ${action.log}`);
        },

        handleAgentEnd: async (action) => {
          console.log('\n✅ [LangChain Agent End]');
          console.log(`   Output: ${action.returnValues}`);
        }
      }
    ];
  }
}

// Instancia global
export const langChainCallbacks = new LangChainDebugCallbacks(
  process.env.LANGCHAIN_VERBOSE === 'true'
);
