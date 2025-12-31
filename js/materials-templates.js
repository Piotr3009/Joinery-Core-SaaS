// ========== MATERIALS TEMPLATES ==========

const MATERIALS_TEMPLATES = {
    'sash': [
        // PRODUCTION STAGE
        {
            stage: 'Production',
            category_name: 'Timber',
            subcategory_name: null,
            default_quantity: 20,
            default_unit: 'm',
            notes: 'Check timber grade before cutting'
        },
        {
            stage: 'Production',
            category_name: 'Windows',
            subcategory_name: 'Rope',
            default_quantity: 10,
            default_unit: 'm',
            notes: null
        },
        {
            stage: 'Production',
            category_name: 'Windows',
            subcategory_name: 'Lead',
            default_quantity: 5,
            default_unit: 'kg',
            notes: null
        },
        {
            stage: 'Production',
            category_name: 'Windows',
            subcategory_name: 'Beads',
            default_quantity: 20,
            default_unit: 'm',
            notes: null
        },
        {
            stage: 'Production',
            category_name: 'Windows',
            subcategory_name: 'Seals',
            default_quantity: 15,
            default_unit: 'm',
            notes: null
        },
        // SPRAYING STAGE
        {
            stage: 'Spraying',
            category_name: 'Paint',
            subcategory_name: null,
            default_quantity: 2,
            default_unit: 'L',
            notes: 'Primer - white'
        },
        {
            stage: 'Spraying',
            category_name: 'Paint',
            subcategory_name: null,
            default_quantity: 3,
            default_unit: 'L',
            notes: 'Topcoat - RAL to be specified'
        },
        // INSTALLATION STAGE
        {
            stage: 'Installation',
            category_name: 'Consumables',
            subcategory_name: 'Other',
            default_quantity: 5,
            default_unit: 'tubes',
            notes: 'Clear silicone'
        }
    ],
    
    'casement': [
        // PRODUCTION STAGE
        {
            stage: 'Production',
            category_name: 'Timber',
            subcategory_name: null,
            default_quantity: 15,
            default_unit: 'm',
            notes: 'Casement timber specification'
        },
        {
            stage: 'Production',
            category_name: 'Windows',
            subcategory_name: 'Beads',
            default_quantity: 15,
            default_unit: 'm',
            notes: null
        },
        {
            stage: 'Production',
            category_name: 'Windows',
            subcategory_name: 'Seals',
            default_quantity: 12,
            default_unit: 'm',
            notes: null
        },
        // SPRAYING STAGE
        {
            stage: 'Spraying',
            category_name: 'Paint',
            subcategory_name: null,
            default_quantity: 2,
            default_unit: 'L',
            notes: 'Primer'
        },
        {
            stage: 'Spraying',
            category_name: 'Paint',
            subcategory_name: null,
            default_quantity: 3,
            default_unit: 'L',
            notes: 'Topcoat - RAL to be specified'
        },
        // INSTALLATION STAGE
        {
            stage: 'Installation',
            category_name: 'Consumables',
            subcategory_name: 'Other',
            default_quantity: 4,
            default_unit: 'tubes',
            notes: 'Silicone'
        }
    ],
    
    'kitchen': [
        // PRODUCTION STAGE
        {
            stage: 'Production',
            category_name: 'Timber',
            subcategory_name: null,
            default_quantity: 30,
            default_unit: 'm',
            notes: 'Kitchen cabinet timber'
        },
        {
            stage: 'Production',
            category_name: 'Hardware',
            subcategory_name: null,
            default_quantity: 50,
            default_unit: 'pcs',
            notes: 'Hinges - specify type'
        },
        {
            stage: 'Production',
            category_name: 'Hardware',
            subcategory_name: null,
            default_quantity: 30,
            default_unit: 'pcs',
            notes: 'Handles - specify type'
        },
        {
            stage: 'Production',
            category_name: 'Hardware',
            subcategory_name: null,
            default_quantity: 20,
            default_unit: 'pairs',
            notes: 'Drawer runners - soft close'
        },
        // SPRAYING STAGE
        {
            stage: 'Spraying',
            category_name: 'Paint',
            subcategory_name: null,
            default_quantity: 5,
            default_unit: 'L',
            notes: 'Primer'
        },
        {
            stage: 'Spraying',
            category_name: 'Paint',
            subcategory_name: null,
            default_quantity: 8,
            default_unit: 'L',
            notes: 'Topcoat - RAL to be specified'
        },
        // INSTALLATION STAGE
        {
            stage: 'Installation',
            category_name: 'Consumables',
            subcategory_name: 'Other',
            default_quantity: 10,
            default_unit: 'tubes',
            notes: 'Silicone for worktop'
        }
    ],
    
    'internal doors': [
        // PRODUCTION STAGE
        {
            stage: 'Production',
            category_name: 'Timber',
            subcategory_name: null,
            default_quantity: 10,
            default_unit: 'm',
            notes: 'Door timber'
        },
        {
            stage: 'Production',
            category_name: 'Doors',
            subcategory_name: 'Hinges',
            default_quantity: 12,
            default_unit: 'pcs',
            notes: 'Door hinges - 3 per door'
        },
        {
            stage: 'Production',
            category_name: 'Doors',
            subcategory_name: 'Locks',
            default_quantity: 4,
            default_unit: 'pcs',
            notes: 'Mortice locks'
        },
        {
            stage: 'Production',
            category_name: 'Doors',
            subcategory_name: 'Handles',
            default_quantity: 8,
            default_unit: 'pcs',
            notes: 'Door handles - 2 per door'
        },
        // SPRAYING STAGE
        {
            stage: 'Spraying',
            category_name: 'Paint',
            subcategory_name: null,
            default_quantity: 2,
            default_unit: 'L',
            notes: 'Primer'
        },
        {
            stage: 'Spraying',
            category_name: 'Paint',
            subcategory_name: null,
            default_quantity: 3,
            default_unit: 'L',
            notes: 'Topcoat'
        },
        // INSTALLATION STAGE
        {
            stage: 'Installation',
            category_name: 'Consumables',
            subcategory_name: 'Screws',
            default_quantity: 200,
            default_unit: 'pcs',
            notes: 'Fixing screws'
        }
    ],
    
    'wardrobe': [
        // PRODUCTION STAGE
        {
            stage: 'Production',
            category_name: 'Timber',
            subcategory_name: null,
            default_quantity: 25,
            default_unit: 'm',
            notes: 'Wardrobe timber'
        },
        {
            stage: 'Production',
            category_name: 'Sheet',
            subcategory_name: null,
            default_quantity: 10,
            default_unit: 'sheets',
            notes: 'Plywood/MDF - specify'
        },
        {
            stage: 'Production',
            category_name: 'Hardware',
            subcategory_name: null,
            default_quantity: 20,
            default_unit: 'pcs',
            notes: 'Hinges or sliding mechanism'
        },
        {
            stage: 'Production',
            category_name: 'Hardware',
            subcategory_name: null,
            default_quantity: 10,
            default_unit: 'pcs',
            notes: 'Handles'
        },
        // SPRAYING STAGE
        {
            stage: 'Spraying',
            category_name: 'Paint',
            subcategory_name: null,
            default_quantity: 4,
            default_unit: 'L',
            notes: 'Primer'
        },
        {
            stage: 'Spraying',
            category_name: 'Paint',
            subcategory_name: null,
            default_quantity: 6,
            default_unit: 'L',
            notes: 'Topcoat'
        },
        // INSTALLATION STAGE
        {
            stage: 'Installation',
            category_name: 'Consumables',
            subcategory_name: 'Screws',
            default_quantity: 300,
            default_unit: 'pcs',
            notes: 'Fixing screws'
        }
    ],
    
    'other': [
        // Empty template - wszystko ręcznie
    ]
};

// Funkcja do pobierania template dla project type
function getMaterialsTemplate(projectType) {
    if (!projectType) return MATERIALS_TEMPLATES['other'];
    
    const type = projectType.toLowerCase().trim();
    return MATERIALS_TEMPLATES[type] || MATERIALS_TEMPLATES['other'];
}
