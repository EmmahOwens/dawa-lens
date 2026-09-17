import { describe, it, expect } from 'vitest';
import { DRA_DATABASE, lookupDRA } from '../draDatabase';

describe('DRA Database & Emergency Ambulance Contacts', () => {
  it('contains complete, well-formed entries for all countries', () => {
    const entries = Object.entries(DRA_DATABASE);
    expect(entries.length).toBeGreaterThan(95);

    for (const [countryKey, data] of entries) {
      expect(data.authority, `${countryKey} must have an authority name`).toBeTruthy();
      expect(data.number, `${countryKey} must have an authority contact number`).toBeTruthy();
      expect(data.ambulance, `${countryKey} must have an ambulance/emergency number`).toBeTruthy();
      if (data.website) {
        expect(data.website).toMatch(/^https?:\/\//);
      }
    }
  });

  describe('Uganda & East African Community', () => {
    it('returns verified NDA and emergency ambulance contacts for Uganda', () => {
      const uganda = lookupDRA('Uganda');
      expect(uganda).toBeDefined();
      expect(uganda?.authority).toBe('National Drug Authority (NDA)');
      expect(uganda?.number).toContain('0800 101 622');
      expect(uganda?.ambulance).toBe('112 / 999');
      expect(uganda?.website).toBe('https://www.nda.or.ug');
    });

    it('returns verified PPB and emergency ambulance contacts for Kenya', () => {
      const kenya = lookupDRA('Kenya');
      expect(kenya).toBeDefined();
      expect(kenya?.authority).toContain('Pharmacy & Poisons Board');
      expect(kenya?.ambulance).toBe('999 / 112');
      expect(kenya?.website).toBe('https://pharmacyboardkenya.org');
    });

    it('returns verified TMDA and emergency ambulance contacts for Tanzania', () => {
      const tanzania = lookupDRA('Tanzania');
      expect(tanzania).toBeDefined();
      expect(tanzania?.authority).toContain('TMDA');
      expect(tanzania?.number).toBe('0800 110 084');
      expect(tanzania?.ambulance).toBe('114 / 115');
      expect(tanzania?.website).toBe('https://www.tmda.go.tz');
    });

    it('returns verified Rwanda FDA and SAMU emergency contact for Rwanda', () => {
      const rwanda = lookupDRA('Rwanda');
      expect(rwanda).toBeDefined();
      expect(rwanda?.authority).toContain('Rwanda Food & Drugs Authority');
      expect(rwanda?.number).toBe('9707');
      expect(rwanda?.ambulance).toBe('912');
      expect(rwanda?.website).toBe('https://www.rwandafda.gov.rw');
    });
  });

  describe('Updated & Restructured Regulatory Authorities', () => {
    it('returns newly restructured AMMPS and ambulance for Morocco', () => {
      const morocco = lookupDRA('Morocco');
      expect(morocco).toBeDefined();
      expect(morocco?.authority).toContain('AMMPS');
      expect(morocco?.ambulance).toBe('150 / 15');
      expect(morocco?.website).toBe('https://ammps.sante.gov.ma');
    });

    it('returns newly restructured ANARME and ambulance for Mozambique', () => {
      const mozambique = lookupDRA('Mozambique');
      expect(mozambique).toBeDefined();
      expect(mozambique?.authority).toContain('ANARME');
      expect(mozambique?.ambulance).toBe('117 / 112');
      expect(mozambique?.website).toBe('https://anarme.gov.mz');
    });

    it('returns newly restructured PMRA and ambulance for Malawi', () => {
      const malawi = lookupDRA('Malawi');
      expect(malawi).toBeDefined();
      expect(malawi?.authority).toContain('PMRA');
      expect(malawi?.ambulance).toBe('998 / 118');
      expect(malawi?.website).toBe('https://www.pmra.mw');
    });

    it('returns newly restructured ARP and SAMU for Senegal', () => {
      const senegal = lookupDRA('Senegal');
      expect(senegal).toBeDefined();
      expect(senegal?.authority).toContain('ARP');
      expect(senegal?.ambulance).toBe('1515');
      expect(senegal?.website).toBe('https://www.arp.sn');
    });

    it('returns newly restructured ARMED and ambulance for Angola', () => {
      const angola = lookupDRA('Angola');
      expect(angola).toBeDefined();
      expect(angola?.authority).toContain('ARMED');
      expect(angola?.ambulance).toBe('112');
      expect(angola?.website).toBe('https://www.armed.gov.ao');
    });

    it('returns newly restructured ACOREP for DR Congo', () => {
      const drc = lookupDRA('Democratic Republic of the Congo');
      expect(drc).toBeDefined();
      expect(drc?.authority).toContain('ACOREP');
      expect(drc?.ambulance).toBe('112');
      expect(drc?.website).toBe('https://acorep.gouv.cd');
    });

    it('returns newly restructured NNGYK for Hungary', () => {
      const hungary = lookupDRA('Hungary');
      expect(hungary).toBeDefined();
      expect(hungary?.authority).toContain('NNGYK');
      expect(hungary?.ambulance).toBe('104 / 112');
      expect(hungary?.website).toBe('https://nngyk.gov.hu');
    });
  });

  describe('Major International Travel Destinations', () => {
    it('returns verified contacts for the United States', () => {
      const usa = lookupDRA('United States');
      expect(usa).toBeDefined();
      expect(usa?.authority).toContain('FDA');
      expect(usa?.ambulance).toBe('911');
      expect(usa?.website).toBe('https://www.fda.gov');
    });

    it('returns verified contacts for the United Kingdom', () => {
      const uk = lookupDRA('United Kingdom');
      expect(uk).toBeDefined();
      expect(uk?.authority).toContain('MHRA');
      expect(uk?.ambulance).toBe('999 / 112');
      expect(uk?.website).toBe('https://www.gov.uk/mhra');
    });

    it('returns verified contacts for France', () => {
      const france = lookupDRA('France');
      expect(france).toBeDefined();
      expect(france?.authority).toContain('ANSM');
      expect(france?.ambulance).toBe('15 / 112');
      expect(france?.website).toBe('https://ansm.sante.fr');
    });

    it('returns verified contacts for Germany', () => {
      const germany = lookupDRA('Germany');
      expect(germany).toBeDefined();
      expect(germany?.authority).toContain('BfArM');
      expect(germany?.ambulance).toBe('112');
    });

    it('returns verified contacts for Japan', () => {
      const japan = lookupDRA('Japan');
      expect(japan).toBeDefined();
      expect(japan?.authority).toContain('PMDA');
      expect(japan?.ambulance).toBe('119');
    });

    it('returns verified contacts for Australia', () => {
      const aus = lookupDRA('Australia');
      expect(aus).toBeDefined();
      expect(aus?.authority).toContain('TGA');
      expect(aus?.ambulance).toBe('000 / 112');
    });

    it('returns verified contacts for UAE', () => {
      const uae = lookupDRA('United Arab Emirates');
      expect(uae).toBeDefined();
      expect(uae?.authority).toContain('MOHAP');
      expect(uae?.ambulance).toBe('998 / 112');
    });

    it('returns verified contacts for Saudi Arabia', () => {
      const saudi = lookupDRA('Saudi Arabia');
      expect(saudi).toBeDefined();
      expect(saudi?.authority).toContain('SFDA');
      expect(saudi?.number).toBe('19999');
      expect(saudi?.ambulance).toBe('997 / 911');
    });

    it('returns verified contacts for India', () => {
      const india = lookupDRA('India');
      expect(india).toBeDefined();
      expect(india?.authority).toContain('CDSCO');
      expect(india?.ambulance).toContain('108');
    });

    it('returns verified contacts for Sri Lanka', () => {
      const srilanka = lookupDRA('Sri Lanka');
      expect(srilanka).toBeDefined();
      expect(srilanka?.authority).toContain('NMRA');
      expect(srilanka?.ambulance).toBe('1990');
    });
  });

  describe('Alias Resolution & Collision Protection', () => {
    it('resolves common aliases for United States', () => {
      expect(lookupDRA('USA')?.authority).toContain('FDA');
      expect(lookupDRA('United States')?.authority).toContain('FDA');
      expect(lookupDRA('United States of America')?.authority).toContain('FDA');
      expect(lookupDRA('America')?.authority).toContain('FDA');
    });

    it('resolves common aliases for United Kingdom', () => {
      expect(lookupDRA('UK')?.authority).toContain('MHRA');
      expect(lookupDRA('United Kingdom')?.authority).toContain('MHRA');
      expect(lookupDRA('Great Britain')?.authority).toContain('MHRA');
      expect(lookupDRA('England')?.authority).toContain('MHRA');
    });

    it('resolves common aliases for UAE', () => {
      expect(lookupDRA('UAE')?.authority).toContain('MOHAP');
      expect(lookupDRA('United Arab Emirates')?.authority).toContain('MOHAP');
      expect(lookupDRA('Dubai')?.authority).toContain('MOHAP');
    });

    it('resolves common aliases for DRC', () => {
      expect(lookupDRA('DRC')?.authority).toContain('ACOREP');
      expect(lookupDRA('DR Congo')?.authority).toContain('ACOREP');
      expect(lookupDRA('Democratic Republic of the Congo')?.authority).toContain('ACOREP');
    });

    it('resolves common aliases for South Korea', () => {
      expect(lookupDRA('South Korea')?.authority).toContain('MFDS');
      expect(lookupDRA('Republic of Korea')?.authority).toContain('MFDS');
      expect(lookupDRA('Korea')?.authority).toContain('MFDS');
    });

    it('resolves common aliases for Czech Republic', () => {
      expect(lookupDRA('Czech Republic')?.authority).toContain('SÚKL');
      expect(lookupDRA('Czechia')?.authority).toContain('SÚKL');
    });

    it('resolves Côte d\'Ivoire with or without accents', () => {
      expect(lookupDRA("Côte d'Ivoire")?.authority).toContain('AIRP');
      expect(lookupDRA('Cote d Ivoire')?.authority).toContain('AIRP');
      expect(lookupDRA('Ivory Coast')?.authority).toContain('AIRP');
    });

    it('protects against substring collisions (Ukraine does NOT match UK)', () => {
      const ukraine = lookupDRA('Ukraine');
      expect(ukraine?.authority).toContain('State Expert Center');
      expect(ukraine?.authority).not.toContain('MHRA');
      expect(ukraine?.ambulance).toBe('103 / 112');
    });

    it('protects against substring collisions (Romania does NOT match Oman)', () => {
      const romania = lookupDRA('Romania');
      expect(romania?.authority).toContain('ANMDMR');
      expect(romania?.ambulance).toBe('112');
    });

    it('returns null for unknown destinations', () => {
      expect(lookupDRA('')).toBeNull();
      expect(lookupDRA('Atlantis')).toBeNull();
      expect(lookupDRA('12345')).toBeNull();
    });
  });
});
