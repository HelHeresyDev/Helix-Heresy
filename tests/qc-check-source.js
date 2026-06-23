const fs = require('fs');
const src = fs.readFileSync('app.js', 'utf8');

console.log('corpseProcessingInventoryRecovery:', src.includes('function corpseProcessingInventoryRecovery'));
console.log('addCorpseProcessingInventoryRecovery:', src.includes('function addCorpseProcessingInventoryRecovery'));
console.log('addCorpseProcessingInventoryRecovery(target):', src.includes('addCorpseProcessingInventoryRecovery(target)'));
console.log('source corpse processing:', src.includes('source: "corpse processing"'));
console.log('key ruinedOrganicMatter:', src.includes('key: "ruinedOrganicMatter"'));
console.log('key biomass:', src.includes('key: "biomass"'));
console.log('addInventoryItem recovery:', src.includes('addInventoryItem(recovery.key, recovery.amount, recovery.source)'));
console.log('NOT contain Recovered material:', !src.includes('Recovered material:'));
console.log('NOT contain Recovery logged:', !src.includes('Recovery logged:'));
console.log('NOT contain recovering spam:', !src.includes('recovering ${CORPSE_PROCESSING_BIOMASS_GAIN} Biomass'));