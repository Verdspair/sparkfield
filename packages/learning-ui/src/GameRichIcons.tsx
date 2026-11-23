import React, { useId } from 'react';
import { lookupItemById } from '@pkg/contracts';

export type GameItemIconSize = 'xs' | 'sm' | 'md' | 'lg';

export type StatTokenKind =
  | 'phys'
  | 'magic'
  | 'true'
  | 'shield'
  | 'hp'
  | 'as'
  | 'crit'
  | 'armor'
  | 'mr'
  | 'mana'
  | 'gold';

interface ComponentPalette {
  readonly primary: string;
  readonly light: string;
  readonly deep: string;
  readonly border: string;
}

const COMPONENT_PALETTES: Readonly<Record<string, ComponentPalette>> = {
  C_SWORD: {
    primary: '#f59e0b',
    light: '#fde68a',
    deep: '#2c1506',
    border: '#fbbf24',
  },
  C_BOW: {
    primary: '#fde047',
    light: '#fef9c3',
    deep: '#282206',
    border: '#facc15',
  },
  C_ROD: {
    primary: '#38bdf8',
    light: '#bae6fd',
    deep: '#072236',
    border: '#7dd3fc',
  },
  C_TEAR: {
    primary: '#60a5fa',
    light: '#dbeafe',
    deep: '#0a1c3d',
    border: '#93c5fd',
  },
  C_VEST: {
    primary: '#fb923c',
    light: '#fed7aa',
    deep: '#2d1408',
    border: '#fdba74',
  },
  C_CLOAK: {
    primary: '#c084fc',
    light: '#f3e8ff',
    deep: '#220d38',
    border: '#d8b4fe',
  },
  C_BELT: {
    primary: '#34d399',
    light: '#a7f3d0',
    deep: '#06291e',
    border: '#6ee7b7',
  },
  C_GLOVE: {
    primary: '#fb7185',
    light: '#fecdd3',
    deep: '#300c19',
    border: '#fda4af',
  },
  C_RUBBING: {
    primary: '#fef08a',
    light: '#fffbeb',
    deep: '#2f2205',
    border: '#f59e0b',
  },
};

const EMBLEM_COLORS: Readonly<Record<string, { primary: string; light: string; deep: string }>> = {
  E_DYSON: { primary: '#fb923c', light: '#ffedd5', deep: '#2c1306' },
  E_CLOUD: { primary: '#60a5fa', light: '#dbeafe', deep: '#091b3a' },
  E_DILATION: { primary: '#fde047', light: '#fef9c3', deep: '#272006' },
  E_EUROPA: { primary: '#34d399', light: '#d1fae5', deep: '#06261d' },
  E_ARRAY: { primary: '#38bdf8', light: '#e0f2fe', deep: '#072033' },
  E_ANTIMATTER: { primary: '#f59e0b', light: '#fef3c7', deep: '#2b1505' },
  E_STARGATE: { primary: '#c084fc', light: '#f3e8ff', deep: '#200c36' },
  E_SWARM: { primary: '#fb7185', light: '#ffe4e6', deep: '#2e0b17' },
};

type CompletedMotif =
  | 'blade_heavy'
  | 'rail_cannon'
  | 'crit_edge'
  | 'lifesteal_axe'
  | 'piercer'
  | 'mana_igniter'
  | 'arcane_crown'
  | 'ion_ring'
  | 'aegis_shield'
  | 'gargoyle_plate'
  | 'cloak_ward'
  | 'vital_pump'
  | 'gauntlet_orb';

const COMPLETED_MOTIF_MAP: Readonly<Record<string, CompletedMotif>> = {
  I_FUSION_BLADE: 'blade_heavy',
  I_HULL_BREAKER: 'blade_heavy',
  I_LORENTZ_RAIL: 'rail_cannon',
  I_HYPER_SWARM: 'rail_cannon',
  I_PLASMA_SUBCANNON: 'rail_cannon',
  I_STRONG_CRIT_EDGE: 'crit_edge',
  I_LASER_SIGHT: 'crit_edge',
  I_BLINDSPOT_LENS: 'crit_edge',
  I_LIFE_AXE: 'lifesteal_axe',
  I_MASS_CONVERTER: 'lifesteal_axe',
  I_ARMOR_PIERCER: 'piercer',
  I_SPECTRUM_MAG: 'piercer',
  I_FUSION_IGNITER: 'mana_igniter',
  I_PULSE_ACCELERATOR: 'mana_igniter',
  I_SUPERCOMP_ARRAY: 'mana_igniter',
  I_ZERO_POINT_SPRING: 'mana_igniter',
  I_STELLAR_CROWN: 'arcane_crown',
  I_NON_EUCLID_LENS: 'arcane_crown',
  I_IONOSPHERE_RING: 'ion_ring',
  I_FARADAY_COAT: 'ion_ring',
  I_FALLOUT_BRAND: 'ion_ring',
  I_KEEL_FIELD: 'aegis_shield',
  I_POLAR_SHIELD_ARMOR: 'aegis_shield',
  I_NEUTRON_PLATE: 'aegis_shield',
  I_MAGNETOSPHERE_GARB: 'gargoyle_plate',
  I_RED_GIANT_MAIL: 'gargoyle_plate',
  I_ONEILL_ARMOR: 'gargoyle_plate',
  I_ZERO_STASIS_FILM: 'cloak_ward',
  I_SLOW_FOG_CLOAK: 'cloak_ward',
  I_PHASE_TALISMAN: 'cloak_ward',
  I_TACTICAL_EXO: 'vital_pump',
  I_REVIVAL_PUMP: 'vital_pump',
  I_ECOSPHERE_FILM: 'vital_pump',
  I_DEADHAND_BELT: 'vital_pump',
  I_QUANTUM_TRIGGER: 'gauntlet_orb',
  I_INERTIA_GAUNTLET: 'gauntlet_orb',
};

const SIZE_PX: Readonly<Record<GameItemIconSize, number>> = {
  xs: 20,
  sm: 26,
  md: 38,
  lg: 44,
};

function normalizeItemId(itemId: string): string {
  return itemId === 'C_SPATULA' ? 'C_RUBBING' : itemId;
}

function renderComponentGlyph(
  id: string,
  primary: string,
  light: string,
): React.JSX.Element {
  switch (id) {
    case 'C_SWORD':
      return (
        <g>
          <path
            d="M29.5 8.5L26 15.5L17.5 24L14 20.5L22.5 12L29.5 8.5Z"
            fill={light}
            stroke={primary}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M27.5 10.5L17 21" stroke={primary} strokeWidth="1.4" strokeLinecap="round" />
          <path
            d="M12.5 18.5L21.5 27.5"
            stroke={primary}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path d="M14.5 25.5L10 30" stroke={light} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="9.2" cy="30.8" r="2" fill={primary} />
        </g>
      );
    case 'C_BOW':
      return (
        <g>
          <path
            d="M14 9C24.5 11.5 28 19.5 24.5 31"
            fill="none"
            stroke={primary}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M14.5 10.5L23.5 29.5"
            stroke={light}
            strokeWidth="1.1"
            strokeDasharray="2 1.5"
            opacity="0.88"
          />
          <path
            d="M10.5 24.5L29 14.5"
            stroke={light}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polygon points="31,13.5 25.8,13.2 28.2,17.8" fill={primary} />
          <path d="M10 22.5L12.5 27" stroke={primary} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'C_ROD':
      return (
        <g>
          <path d="M11 30.5L22.5 19" stroke={primary} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="25.5" cy="14.5" r="5.6" fill={primary} fillOpacity="0.28" stroke={light} strokeWidth="1.4" />
          <path
            d="M25.5 7.5L27.1 12.9L32.5 14.5L27.1 16.1L25.5 21.5L23.9 16.1L18.5 14.5L23.9 12.9Z"
            fill={light}
          />
          <circle cx="11" cy="30.5" r="2" fill={light} />
        </g>
      );
    case 'C_TEAR':
      return (
        <g>
          <path
            d="M20 7.5C20 7.5 11.5 18 11.5 23.8C11.5 28.6 15.3 32.2 20 32.2C24.7 32.2 28.5 28.6 28.5 23.8C28.5 18 20 7.5 20 7.5Z"
            fill={primary}
            fillOpacity="0.34"
            stroke={light}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="23.5" r="4" fill={primary} stroke={light} strokeWidth="1.2" />
          <path
            d="M16.5 18.5C15.5 20.3 15.2 22 15.5 23.6"
            stroke={light}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      );
    case 'C_VEST':
      return (
        <g>
          <path
            d="M20 8L30 12V20.5C30 26.2 25.8 30.2 20 32.5C14.2 30.2 10 26.2 10 20.5V12L20 8Z"
            fill={primary}
            fillOpacity="0.3"
            stroke={light}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M20 9.5V31" stroke={primary} strokeWidth="1.6" />
          <path d="M12.5 16H27.5" stroke={light} strokeWidth="1.4" opacity="0.85" />
          <polygon points="20,14 23.5,19.5 20,25 16.5,19.5" fill={light} fillOpacity="0.85" />
        </g>
      );
    case 'C_CLOAK':
      return (
        <g>
          <path
            d="M14 11L20 8.5L26 11L30 29.5C26 27.5 23 29.5 20 31.5C17 29.5 14 27.5 10 29.5L14 11Z"
            fill={primary}
            fillOpacity="0.3"
            stroke={light}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M15 17.5C17.8 19.6 22.2 19.6 25 17.5"
            fill="none"
            stroke={light}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M13.5 23C17.2 25.4 22.8 25.4 26.5 23"
            fill="none"
            stroke={primary}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="20" cy="12.5" r="2.2" fill={light} />
        </g>
      );
    case 'C_BELT':
      return (
        <g>
          <rect
            x="9"
            y="14"
            width="22"
            height="12"
            rx="6"
            fill={primary}
            fillOpacity="0.28"
            stroke={light}
            strokeWidth="1.7"
          />
          <circle cx="20" cy="20" r="6.5" fill="#06291e" stroke={primary} strokeWidth="1.8" />
          <path d="M20 16.3V23.7M16.3 20H23.7" stroke={light} strokeWidth="2.1" strokeLinecap="round" />
        </g>
      );
    case 'C_GLOVE':
      return (
        <g>
          <path
            d="M13.5 21V14.5C13.5 13.4 14.4 12.5 15.5 12.5C16.6 12.5 17.5 13.4 17.5 14.5V12C17.5 10.9 18.4 10 19.5 10C20.6 10 21.5 10.9 21.5 12V13.2C21.5 12.1 22.4 11.2 23.5 11.2C24.6 11.2 25.5 12.1 25.5 13.2V22.5C25.5 26.8 22.8 29.8 18.8 29.8C15.5 29.8 13.5 27.6 13.5 24.4V21Z"
            fill={primary}
            fillOpacity="0.34"
            stroke={light}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M29 10L30 12.6L32.6 13.6L30 14.6L29 17.2L28 14.6L25.4 13.6L28 12.6Z"
            fill={light}
          />
          <path
            d="M11 25L11.7 26.8L13.5 27.5L11.7 28.2L11 30L10.3 28.2L8.5 27.5L10.3 26.8Z"
            fill={primary}
          />
        </g>
      );
    default:
      return (
        <g>
          <path
            d="M9.5 26.5L11.5 13L16.5 18L20 9.5L23.5 18L28.5 13L30.5 26.5H9.5Z"
            fill={primary}
            fillOpacity="0.4"
            stroke={light}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <rect x="11" y="27.5" width="18" height="3.2" rx="1.5" fill={primary} />
          <circle cx="20" cy="20.5" r="2.5" fill={light} />
        </g>
      );
  }
}

function renderCompletedMotif(
  motif: CompletedMotif,
  c1: ComponentPalette,
  c2: ComponentPalette,
): React.JSX.Element {
  switch (motif) {
    case 'blade_heavy':
      return (
        <g>
          <path
            d="M30 8.5L24.5 18.5L16.5 26.5L13 23L21 15L30 8.5Z"
            fill={c1.light}
            stroke={c1.primary}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M10.5 9.5L19.5 18.5L24 23"
            stroke={c2.light}
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path d="M11 20.5L19.5 29" stroke={c2.primary} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M13 26.5L9.5 30" stroke={c1.light} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="22.5" cy="16" r="2.2" fill="#fffbeb" />
        </g>
      );
    case 'rail_cannon':
      return (
        <g>
          <path d="M9.5 25L25 11.5" stroke={c1.light} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M13 28.5L28.5 15" stroke={c2.primary} strokeWidth="2.6" strokeLinecap="round" />
          <polygon points="31.5,10 24.5,10.2 29,15.5" fill="#fffbeb" />
          <path d="M12 16.5L18.5 12" stroke={c2.light} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="15.5" cy="23" r="3" fill={c1.primary} stroke="#fffbeb" strokeWidth="1.1" />
        </g>
      );
    case 'crit_edge':
      return (
        <g>
          <path
            d="M29.5 9L23 18.5L15 26L11.5 22.5L19.5 15L29.5 9Z"
            fill={c1.light}
            stroke={c2.primary}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M25.5 13L27.2 17.2L31.5 18.8L27.2 20.4L25.5 24.6L23.8 20.4L19.5 18.8L23.8 17.2Z"
            fill="#fffbeb"
          />
          <circle cx="13.5" cy="14" r="2.3" fill={c2.light} />
          <path d="M11 26.5L15.5 22" stroke={c1.primary} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      );
    case 'lifesteal_axe':
      return (
        <g>
          <path d="M12.5 29.5L26.5 11.5" stroke={c1.light} strokeWidth="2.4" strokeLinecap="round" />
          <path
            d="M17.5 10.5C23 10.5 28.5 14 29.5 20.5C25.5 20.5 22 19 19.5 16.5C17.8 14.8 17 12.8 17.5 10.5Z"
            fill={c1.primary}
            stroke="#fffbeb"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M14 14.5C11 17 10.5 21 12.5 24.5C15 23 16.5 21 17 18.5Z"
            fill={c2.primary}
            stroke={c2.light}
            strokeWidth="1.1"
          />
        </g>
      );
    case 'piercer':
      return (
        <g>
          <path
            d="M25.5 11.5L30.5 14.5V22.5L25.5 27.5"
            fill="none"
            stroke={c2.light}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9.5 20H27" stroke={c1.light} strokeWidth="2.4" strokeLinecap="round" />
          <polygon points="30.5,20 22,15.2 24.2,20 22,24.8" fill={c1.primary} stroke="#fffbeb" strokeWidth="1" />
          <path d="M12 15.5L16.5 20L12 24.5" fill="none" stroke={c2.primary} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'mana_igniter':
      return (
        <g>
          <circle cx="20" cy="19.5" r="8.5" fill={c1.primary} fillOpacity="0.22" stroke={c2.light} strokeWidth="1.6" />
          <path
            d="M20 9.5C24.5 13 26.5 17 25 22.5C23.5 27 17.5 28.5 14.5 24.5C12.5 21.8 13.8 17.5 17.2 16.5"
            fill="none"
            stroke={c1.light}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="20" cy="19.5" r="3.4" fill="#fffbeb" />
        </g>
      );
    case 'arcane_crown':
      return (
        <g>
          <path
            d="M10 26L12 14L16.8 18.5L20 10L23.2 18.5L28 14L30 26H10Z"
            fill={c1.primary}
            fillOpacity="0.45"
            stroke={c2.light}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="20.5" r="2.7" fill="#fffbeb" />
          <circle cx="12" cy="13.5" r="1.6" fill={c1.light} />
          <circle cx="28" cy="13.5" r="1.6" fill={c2.light} />
        </g>
      );
    case 'ion_ring':
      return (
        <g>
          <circle cx="20" cy="19.5" r="8.8" fill="none" stroke={c1.primary} strokeWidth="2.4" />
          <circle cx="20" cy="19.5" r="5.2" fill={c2.primary} fillOpacity="0.3" stroke={c2.light} strokeWidth="1.2" />
          <path
            d="M21.5 10.5L17 19.5H21.2L18.5 28.5"
            fill="none"
            stroke="#fffbeb"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    case 'aegis_shield':
      return (
        <g>
          <path
            d="M20 8.5L29.5 12.2V20.5C29.5 25.8 25.6 29.5 20 31.8C14.4 29.5 10.5 25.8 10.5 20.5V12.2L20 8.5Z"
            fill={c1.primary}
            fillOpacity="0.34"
            stroke={c2.light}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M20 12.5L25.5 15V20.2C25.5 23.4 23.2 26 20 27.6C16.8 26 14.5 23.4 14.5 20.2V15L20 12.5Z"
            fill={c2.primary}
            fillOpacity="0.48"
            stroke="#fffbeb"
            strokeWidth="1.1"
          />
        </g>
      );
    case 'gargoyle_plate':
      return (
        <g>
          <path
            d="M12.5 12.5L20 9.5L27.5 12.5L29 22L20 30L11 22L12.5 12.5Z"
            fill={c1.primary}
            fillOpacity="0.36"
            stroke={c1.light}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <ellipse
            cx="20"
            cy="19.5"
            rx="11"
            ry="4.2"
            transform="rotate(-18 20 19.5)"
            fill="none"
            stroke={c2.light}
            strokeWidth="1.7"
          />
          <circle cx="20" cy="19.5" r="3" fill="#fffbeb" />
        </g>
      );
    case 'cloak_ward':
      return (
        <g>
          <path
            d="M13 11.5L20 8.5L27 11.5L30 28.5L20 24.5L10 28.5L13 11.5Z"
            fill={c1.primary}
            fillOpacity="0.34"
            stroke={c2.light}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M20 12.5L24.5 18L20 23.5L15.5 18Z"
            fill={c2.primary}
            stroke="#fffbeb"
            strokeWidth="1.2"
          />
        </g>
      );
    case 'vital_pump':
      return (
        <g>
          <circle cx="20" cy="19.5" r="9.2" fill={c2.primary} fillOpacity="0.28" stroke={c1.light} strokeWidth="1.7" />
          <path
            d="M20 13.8V25.2M14.3 19.5H25.7"
            stroke="#fffbeb"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <circle cx="20" cy="19.5" r="2.2" fill={c2.primary} />
        </g>
      );
    case 'gauntlet_orb':
      return (
        <g>
          <circle cx="20" cy="19.5" r="8.2" fill={c1.primary} fillOpacity="0.3" stroke={c2.light} strokeWidth="1.7" />
          <polygon points="20,12 26.5,19.5 20,27 13.5,19.5" fill={c2.primary} stroke="#fffbeb" strokeWidth="1.2" />
          <circle cx="20" cy="19.5" r="2.5" fill="#fffbeb" />
        </g>
      );
  }
}

function renderEmblemGlyph(id: string, primary: string, light: string): React.JSX.Element {
  switch (id) {
    case 'E_DYSON':
      return (
        <g>
          <circle cx="20" cy="20" r="4.5" fill={light} />
          <ellipse cx="20" cy="20" rx="10" ry="4" transform="rotate(-28 20 20)" fill="none" stroke={primary} strokeWidth="1.9" />
          <ellipse cx="20" cy="20" rx="10" ry="4" transform="rotate(28 20 20)" fill="none" stroke={light} strokeWidth="1.4" opacity="0.85" />
        </g>
      );
    case 'E_CLOUD':
      return (
        <g>
          <circle cx="20" cy="20" r="7.5" fill="none" stroke={primary} strokeWidth="2" strokeDasharray="5 2.5" />
          <circle cx="20" cy="20" r="3.8" fill={light} />
        </g>
      );
    case 'E_DILATION':
      return (
        <g>
          <path d="M14 12H26L20 20L26 28H14L20 20L14 12Z" fill={primary} fillOpacity="0.35" stroke={light} strokeWidth="1.6" strokeLinejoin="round" />
        </g>
      );
    case 'E_EUROPA':
      return (
        <g>
          <path d="M20 10L26 20L20 30L14 20Z" fill={primary} fillOpacity="0.4" stroke={light} strokeWidth="1.6" />
          <path d="M11.5 22C15 19.5 25 19.5 28.5 22" fill="none" stroke={light} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'E_ARRAY':
      return (
        <g>
          <path d="M12.5 22.5C15.5 14.5 24.5 14.5 27.5 22.5" fill="none" stroke={light} strokeWidth="2" strokeLinecap="round" />
          <path d="M20 16.5V28" stroke={primary} strokeWidth="2" strokeLinecap="round" />
          <circle cx="20" cy="12.5" r="2.6" fill={light} />
        </g>
      );
    case 'E_ANTIMATTER':
      return (
        <g>
          <circle cx="20" cy="20" r="3.4" fill={light} />
          <circle cx="20" cy="20" r="8.2" fill="none" stroke={primary} strokeWidth="1.8" />
          <circle cx="26.5" cy="14.5" r="2" fill={light} />
          <circle cx="13.5" cy="25.5" r="2" fill={primary} />
        </g>
      );
    case 'E_STARGATE':
      return (
        <g>
          <circle cx="20" cy="20" r="8.4" fill="none" stroke={light} strokeWidth="1.8" />
          <path d="M15.5 22.5L20 14L24.5 22.5" fill="none" stroke={primary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="20" cy="22.5" r="2" fill={light} />
        </g>
      );
    default:
      return (
        <g>
          <polygon points="20,11 23.5,13 23.5,17 20,19 16.5,17 16.5,13" fill={light} />
          <polygon points="15,19 18.5,21 18.5,25 15,27 11.5,25 11.5,21" fill={primary} />
          <polygon points="25,19 28.5,21 28.5,25 25,27 21.5,25 21.5,21" fill={primary} />
        </g>
      );
  }
}

export interface GameItemIconProps {
  readonly itemId: string;
  readonly size?: GameItemIconSize;
  readonly className?: string;
  readonly title?: string;
}

export function GameItemIcon({
  itemId,
  size = 'sm',
  className = '',
  title,
}: GameItemIconProps): React.JSX.Element {
  const uid = useId().replace(/:/g, '');
  const normalized = normalizeItemId(itemId);
  const entry = lookupItemById(normalized);
  const px = SIZE_PX[size];
  const resolvedTitle = title ?? entry?.item.name ?? itemId;

  const renderSvgContent = (): React.JSX.Element => {
    if (normalized === 'TOOL_MAGNETIC_REMOVER') {
      return (
        <>
          <defs>
            <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#12324d" />
              <stop offset="100%" stopColor="#091527" />
            </linearGradient>
          </defs>
          <rect x="1.5" y="1.5" width="37" height="37" rx="8" fill={`url(#bg-${uid})`} stroke="#38bdf8" strokeWidth="2" />
          <path
            d="M13 13V22C13 25.9 16.1 29 20 29C23.9 29 27 25.9 27 22V13"
            fill="none"
            stroke="#bae6fd"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <rect x="10.5" y="10" width="5" height="4.5" rx="1" fill="#38bdf8" />
          <rect x="24.5" y="10" width="5" height="4.5" rx="1" fill="#f59e0b" />
          <path d="M18.5 15L21.5 18L19.5 21" fill="none" stroke="#fde047" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    }

    if (normalized === 'TOOL_REFORGER') {
      return (
        <>
          <defs>
            <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3b1d0b" />
              <stop offset="100%" stopColor="#160c07" />
            </linearGradient>
          </defs>
          <rect x="1.5" y="1.5" width="37" height="37" rx="8" fill={`url(#bg-${uid})`} stroke="#fb923c" strokeWidth="2" />
          <path d="M12 28.5L22.5 18" stroke="#fde68a" strokeWidth="2.8" strokeLinecap="round" />
          <rect x="17" y="10.5" width="12.5" height="6.8" rx="1.8" transform="rotate(38 23 14)" fill="#fb923c" stroke="#fffbeb" strokeWidth="1.3" />
          <circle cx="13" cy="14" r="1.7" fill="#fde047" />
          <circle cx="28" cy="26" r="1.5" fill="#fde047" />
        </>
      );
    }

    if (normalized === 'ANVIL_COMPONENT_3' || normalized === 'ANVIL_COMPLETED_4') {
      const isGold = normalized === 'ANVIL_COMPLETED_4';
      const stroke = isGold ? '#f2c97d' : '#cbd5e1';
      return (
        <>
          <rect x="1.5" y="1.5" width="37" height="37" rx="8" fill={isGold ? '#291d09' : '#162033'} stroke={stroke} strokeWidth="2" />
          <path d="M9 17H31L27.5 22.5H23.5L26 30H14L16.5 22.5H12.5L9 17Z" fill={stroke} fillOpacity="0.28" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="20" cy="11.5" r="2.6" fill="#fef08a" />
        </>
      );
    }

    if (entry?.kind === 'flag' || normalized === 'I_MOTHERSHIP_FLAG') {
      return (
        <>
          <defs>
            <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3c2a08" />
              <stop offset="55%" stopColor="#1b2642" />
              <stop offset="100%" stopColor="#2c1d06" />
            </linearGradient>
            <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fde68a" />
            </linearGradient>
          </defs>
          <polygon
            points="20,2 36,9 36,27 20,38 4,27 4,9"
            fill={`url(#bg-${uid})`}
            stroke={`url(#rim-${uid})`}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M13 10V30" stroke="#fef08a" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M14 11H28.5L24.5 16.5L28.5 22H14V11Z" fill="#f59e0b" fillOpacity="0.55" stroke="#fffbeb" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M20 13.2L21 15.6L23.5 16.5L21 17.4L20 19.8L19 17.4L16.5 16.5L19 15.6Z" fill="#fffbeb" />
        </>
      );
    }

    if (entry?.kind === 'emblem') {
      const emColor = EMBLEM_COLORS[entry.item.id] ?? {
        primary: '#f2c97d',
        light: '#fef08a',
        deep: '#241a08',
      };
      return (
        <>
          <defs>
            <radialGradient id={`em-${uid}`} cx="50%" cy="42%" r="60%">
              <stop offset="0%" stopColor={emColor.primary} stopOpacity="0.45" />
              <stop offset="100%" stopColor={emColor.deep} stopOpacity="1" />
            </radialGradient>
            <linearGradient id={`emrim-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#fde68a" />
            </linearGradient>
          </defs>
          <polygon
            points="20,2 35.5,11 35.5,29 20,38 4.5,29 4.5,11"
            fill={`url(#em-${uid})`}
            stroke={`url(#emrim-${uid})`}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <polygon
            points="20,5.5 32.5,12.8 32.5,27.2 20,34.5 7.5,27.2 7.5,12.8"
            fill="none"
            stroke={emColor.light}
            strokeWidth="0.9"
            opacity="0.45"
          />
          {renderEmblemGlyph(entry.item.id, emColor.primary, emColor.light)}
        </>
      );
    }

    if (entry?.kind === 'completed') {
      const [cid1 = 'C_SWORD', cid2 = cid1] = entry.item.components;
      const c1 = COMPONENT_PALETTES[cid1] ?? COMPONENT_PALETTES.C_SWORD!;
      const c2 = COMPONENT_PALETTES[cid2] ?? c1;
      const motif = COMPLETED_MOTIF_MAP[entry.item.id] ?? 'blade_heavy';
      return (
        <>
          <defs>
            <linearGradient id={`compbg-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={c1.deep} />
              <stop offset="50%" stopColor="#0e172a" />
              <stop offset="100%" stopColor={c2.deep} />
            </linearGradient>
            <linearGradient id={`glow-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={c1.primary} stopOpacity="0.42" />
              <stop offset="50%" stopColor="#0f172a" stopOpacity="0.1" />
              <stop offset="100%" stopColor={c2.primary} stopOpacity="0.42" />
            </linearGradient>
            <linearGradient id={`goldrim-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="48%" stopColor="#d4a24c" />
              <stop offset="100%" stopColor="#f5d48a" />
            </linearGradient>
          </defs>
          <rect
            x="1.5"
            y="1.5"
            width="37"
            height="37"
            rx="7"
            fill={`url(#compbg-${uid})`}
            stroke={`url(#goldrim-${uid})`}
            strokeWidth="2.2"
          />
          <rect x="3" y="3" width="34" height="34" rx="5.5" fill={`url(#glow-${uid})`} />
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="4.8"
            fill="none"
            stroke="rgba(255,250,235,0.2)"
            strokeWidth="0.8"
          />
          {renderCompletedMotif(motif, c1, c2)}
          <circle cx="28.2" cy="33.2" r="2.8" fill={c1.primary} stroke="#0a1120" strokeWidth="1.2" />
          <circle cx="33.6" cy="33.2" r="2.8" fill={c2.primary} stroke="#0a1120" strokeWidth="1.2" />
        </>
      );
    }

    if (entry?.kind === 'component' || entry?.kind === 'spatula') {
      const pal = COMPONENT_PALETTES[normalized] ?? COMPONENT_PALETTES.C_RUBBING!;
      return (
        <>
          <defs>
            <radialGradient id={`cbg-${uid}`} cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor={pal.primary} stopOpacity="0.34" />
              <stop offset="100%" stopColor={pal.deep} stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect
            x="1.5"
            y="1.5"
            width="37"
            height="37"
            rx="7.5"
            fill={`url(#cbg-${uid})`}
            stroke={pal.border}
            strokeWidth="2"
          />
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="5.5"
            fill="none"
            stroke={pal.light}
            strokeWidth="0.8"
            opacity="0.32"
          />
          {renderComponentGlyph(normalized, pal.primary, pal.light)}
        </>
      );
    }

    return (
      <>
        <rect x="1.5" y="1.5" width="37" height="37" rx="7.5" fill="#17233a" stroke="#f2c97d" strokeWidth="2" />
        <polygon points="20,9 29,20 20,31 11,20" fill="#f2c97d" fillOpacity="0.38" stroke="#fef08a" strokeWidth="1.5" />
      </>
    );
  };

  return (
    <span
      className={`lui-item-icon lui-item-icon--${size} ${className}`.trim()}
      data-item-icon-id={itemId}
      title={resolvedTitle}
      aria-hidden="true"
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 40 40"
        fill="none"
        className="lui-item-icon__svg"
      >
        {renderSvgContent()}
      </svg>
    </span>
  );
}

export function StatInlineIcon({ kind }: { readonly kind: StatTokenKind }): React.JSX.Element {
  const renderPath = (): React.JSX.Element => {
    switch (kind) {
      case 'phys':
        return (
          <g>
            <path d="M13.5 2.5L7 9L5.5 7.5L11 2.5H13.5Z" fill="currentColor" />
            <path d="M13 3L6.2 9.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M4.5 8L8 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M5.5 10.5L3 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </g>
        );
      case 'magic':
        return (
          <path
            d="M8 1.6L9.7 6.3L14.4 8L9.7 9.7L8 14.4L6.3 9.7L1.6 8L6.3 6.3Z"
            fill="currentColor"
          />
        );
      case 'true':
        return (
          <g>
            <polygon
              points="8,1.8 14,8 8,14.2 2,8"
              fill="currentColor"
              fillOpacity="0.28"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path d="M8 4.2V11.8M4.2 8H11.8" stroke="currentColor" strokeWidth="1.3" />
          </g>
        );
      case 'shield':
        return (
          <path
            d="M8 1.8L13.4 4.1V8.4C13.4 11.5 11.1 13.5 8 14.6C4.9 13.5 2.6 11.5 2.6 8.4V4.1L8 1.8Z"
            fill="currentColor"
            fillOpacity="0.3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        );
      case 'hp':
        return (
          <g>
            <rect
              x="2"
              y="2"
              width="12"
              height="12"
              rx="3.2"
              fill="currentColor"
              fillOpacity="0.24"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M8 4.6V11.4M4.6 8H11.4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        );
      case 'as':
        return (
          <g>
            <path d="M2.5 11.5L12.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <polygon points="14,2.3 8.8,3.2 12.1,7" fill="currentColor" />
            <path d="M2.5 7L6.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
          </g>
        );
      case 'crit':
        return (
          <path
            d="M8 1.4L9.8 5.2L13.8 3.6L11.4 7.3L14.6 9.8L10.4 10.4L10.6 14.5L7.6 11.5L4.1 13.8L5.3 9.7L1.6 8.2L5.6 6.7L4.4 2.7L7.5 5.2Z"
            fill="currentColor"
          />
        );
      case 'armor':
        return (
          <g>
            <path
              d="M8 2L13 4.2V8.6C13 11.4 10.9 13.3 8 14.3C5.1 13.3 3 11.4 3 8.6V4.2L8 2Z"
              fill="currentColor"
              fillOpacity="0.28"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path d="M8 3.2V13.4M4 7.2H12" stroke="currentColor" strokeWidth="1.2" />
          </g>
        );
      case 'mr':
        return (
          <g>
            <circle cx="8" cy="8" r="2.2" fill="currentColor" />
            <path d="M4.2 5.2C5.2 4 6.5 3.3 8 3.3C9.5 3.3 10.8 4 11.8 5.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M2.6 9.5C3.9 11.6 5.8 12.7 8 12.7C10.2 12.7 12.1 11.6 13.4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        );
      case 'mana':
        return (
          <path
            d="M8 1.8C8 1.8 3.2 7.1 3.2 10.2C3.2 12.8 5.3 14.6 8 14.6C10.7 14.6 12.8 12.8 12.8 10.2C12.8 7.1 8 1.8 8 1.8Z"
            fill="currentColor"
          />
        );
      case 'gold':
        return (
          <g>
            <circle cx="8" cy="8" r="5.6" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="2.2" fill="currentColor" />
          </g>
        );
    }
  };

  return (
    <svg
      className="lui-stat-icon"
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      {renderPath()}
    </svg>
  );
}

const KEYWORD_RULES: ReadonlyArray<readonly [StatTokenKind, readonly string[]]> = [
  ['true', ['真实伤害']],
  ['as', ['攻击速度', '攻速']],
  ['phys', ['物理伤害', '物理技能', '物理破甲', '护甲穿透', '攻击力', '普通攻击', '普攻', '物穿', '基础攻击', '攻击']],
  ['magic', ['魔法伤害', '魔法技能', '魔抗穿透', '魔抗击碎', '法术强度', '技能效能', '法强', '法穿', '双穿']],
  ['crit', ['暴击伤害', '暴击率', '暴击']],
  ['shield', ['护盾强度', '护盾', '获盾', '等离子盾']],
  ['mana', ['初始法力', '最大法力', '法力', '回蓝']],
  ['armor', ['护甲', '双抗']],
  ['mr', ['魔抗']],
  ['hp', ['最大生命', '已损生命', '生命值', '生命', '全能吸血', '治疗', '回复', '恢复', '修复']],
  ['gold', ['金币']],
];

const KEYWORD_KIND_MAP = new Map<string, StatTokenKind>();
const ALL_KEYWORDS: string[] = [];
for (const [kind, words] of KEYWORD_RULES) {
  for (const w of words) {
    KEYWORD_KIND_MAP.set(w, kind);
    ALL_KEYWORDS.push(w);
  }
}
ALL_KEYWORDS.sort((a, b) => b.length - a.length);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KW_ALT = ALL_KEYWORDS.map(escapeRegex).join('|');
const NUM_SEQ = '[+-]?\\d+(?:\\.\\d+)?%?(?:/[+-]?\\d+(?:\\.\\d+)?%?)*';
const SIGNED_NUM_SEQ = '[+-]\\d+(?:\\.\\d+)?%?(?:/[+-]?\\d+(?:\\.\\d+)?%?)*';

const RICH_TOKEN_REGEX = new RegExp(
  `(?<goldG>[+-]?\\d+G(?![A-Za-z]))` +
    `|(?<goldJin>\\d+金(?![属色]))` +
    `|(?<apCoef>\\d+(?:\\.\\d+)?P(?![A-Za-z]))` +
    `|(?<preNum>(?<![\\d./P+-])${NUM_SEQ}\\s*点?\\s*)?(?<kw>${KW_ALT})(?<postNum>\\s*${SIGNED_NUM_SEQ})?`,
  'g',
);

const NUM_SPLIT_REGEX = /([+-]?\d+(?:\.\d+)?%?(?:\/[+-]?\d+(?:\.\d+)?%?)*P?G?)/g;

export interface RichGameTextSegment {
  readonly kind: 'text' | StatTokenKind;
  readonly raw: string;
}

export function tokenizeRichGameText(text: string): readonly RichGameTextSegment[] {
  if (!text) return [];
  const rawTokens: RichGameTextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(RICH_TOKEN_REGEX)) {
    const start = match.index ?? 0;
    const full = match[0];
    if (start > cursor) {
      rawTokens.push({ kind: 'text', raw: text.slice(cursor, start) });
    }
    const groups = match.groups ?? {};
    let kind: StatTokenKind = 'magic';
    if (groups.goldG || groups.goldJin) {
      kind = 'gold';
    } else if (groups.apCoef) {
      kind = 'magic';
    } else if (groups.kw) {
      kind = KEYWORD_KIND_MAP.get(groups.kw) ?? 'magic';
    }
    rawTokens.push({ kind, raw: full });
    cursor = start + full.length;
  }

  if (cursor < text.length) {
    rawTokens.push({ kind: 'text', raw: text.slice(cursor) });
  }

  const merged: RichGameTextSegment[] = [];
  for (const seg of rawTokens) {
    const prev = merged[merged.length - 1];
    if (prev && prev.kind !== 'text' && prev.kind === seg.kind) {
      merged[merged.length - 1] = { kind: prev.kind, raw: prev.raw + seg.raw };
    } else {
      merged.push(seg);
    }
  }
  return merged;
}

function renderTokenTextParts(raw: string): React.ReactNode {
  const pieces = raw.split(NUM_SPLIT_REGEX);
  return pieces.map((piece, idx) => {
    if (!piece) return null;
    if (idx % 2 === 1) {
      return (
        <strong key={idx} className="lui-stat-num">
          {piece}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{piece}</React.Fragment>;
  });
}

export interface RichGameTextProps {
  readonly text: string;
  readonly className?: string;
}

export function RichGameText({ text, className = '' }: RichGameTextProps): React.JSX.Element {
  const segments = tokenizeRichGameText(text);
  return (
    <span className={`lui-rich-game-text ${className}`.trim()}>
      {segments.map((seg, idx) =>
        seg.kind === 'text' ? (
          <React.Fragment key={idx}>{seg.raw}</React.Fragment>
        ) : (
          <span key={idx} className={`lui-stat-token lui-stat-token--${seg.kind}`}>
            <StatInlineIcon kind={seg.kind} />
            <span>{renderTokenTextParts(seg.raw)}</span>
          </span>
        ),
      )}
    </span>
  );
}
