# Area Tools - Chat Prompt Best Practices

This guide covers effective prompts for the AI chat interface. The system uses a two-phase architecture where the LLM handles intent/semantics and code handles all math calculations.

---

## Creating New Programs

### Basic Program Creation

```
Create a 5000 m² office building
```

```
Generate a school program for 500 students, total 8000 m²
```

### Programs with Proportional Distribution

The AI understands ratios and percentages - you don't need to calculate exact values.

```
Create a 10,000 m² office with 3 tenants at 20%, 30%, and 50%
```

```
Design a 15,000 m² mixed-use building:
- 60% residential
- 30% commercial  
- 10% parking
```

### Programs with Fixed + Proportional Areas

Use "exactly" or specify m² for fixed areas, ratios for the rest.

```
Create 8,000 m² hospital:
- Emergency department: exactly 500 m²
- ICU: exactly 300 m²
- Patient rooms: 40% of remaining
- Support services: 30% of remaining
- Administration: 30% of remaining
```

### Programs with Grouping

Mention group names to auto-organize areas.

```
Create 12,000 m² school:
- Classrooms (Teaching): 5 × 80 m²
- Labs (Teaching): 3 × 120 m²
- Library (Resources): 400 m²
- Gym (Athletics): 800 m²
- Cafeteria (Services): 300 m²
```

---

## Splitting Areas

### Equal Splits

```
Split the Office area into 4 equal parts
```

```
Divide Residential into 8 apartments
```

### Proportional Splits

```
Split the Commercial area 60/40 into Retail and Restaurant
```

```
Divide Office into:
- Open workspace: 70%
- Meeting rooms: 20%
- Support: 10%
```

### Named Splits with Groups

```
Split the Tenant A area into:
- Private offices (Tenant A - Private)
- Open plan (Tenant A - Open)
- Meeting rooms (Tenant A - Shared)
at 30/50/20 ratio
```

---

## Scaling & Adjusting

These operations are handled deterministically by code (not LLM) for exact results.

### Scale to Target

```
Scale all areas to 5000 m² total
```

```
Adjust selected areas to 3000 m²
```

### Percentage Adjustments

```
Increase all areas by 10%
```

```
Reduce the Office by 15%
```

```
Decrease selected areas by 20%
```

---

## Merging Areas

```
Merge Reception and Lobby into one Welcome Area
```

```
Combine all storage areas into Central Storage
```

---

## Group Operations

### Creating Groups

```
Create a group called "Public Spaces" with Reception, Lobby, and Café
```

```
Organize the classrooms into "Teaching Block A"
```

### Splitting Groups

```
Split the Residential group into 4 floors
```

```
Divide the Office group 60/40 into East Wing and West Wing
```

### Merging Within Groups

```
Merge all areas in the Storage group into one
```

---

## Adding Notes & Context

### Area Notes

```
Add note to Reception: "Should have direct visual connection to entrance"
```

```
Note on Meeting Rooms: "Requires AV equipment and natural light"
```

### Architectural Context

```
The lobby needs 6m ceiling height for dramatic entrance
```

```
Circulation should be 15% of total program
```

---

## Complex Multi-Step Examples

### Office Building with Multiple Tenants

```
Create a 20,000 m² office building with:
- 3 tenants at 25%, 35%, 40% 
- Shared lobby: exactly 300 m²
- Common meeting center: exactly 500 m²
- Building services: exactly 400 m²

Each tenant needs:
- Open office: 60%
- Private offices: 25%
- Meeting rooms: 15%
```

### Residential with Unit Mix

```
Design 15,000 m² residential:
- Studios (20%): 35 m² each
- 1-bedroom (40%): 55 m² each
- 2-bedroom (30%): 85 m² each
- 3-bedroom (10%): 120 m² each

Plus common areas:
- Lobby: 150 m²
- Gym: 200 m²
- Rooftop terrace: 300 m²
```

### School Program

```
Create 8,000 m² primary school for 400 students:

Teaching (50%):
- Regular classrooms: 24 × 65 m²
- Special ed rooms: 4 × 50 m²
- Science labs: 2 × 90 m²

Resources (15%):
- Library: 300 m²
- Computer lab: 150 m²

Athletics (20%):
- Gymnasium: 800 m²
- Outdoor covered area: 400 m²

Admin & Services (15%):
- Administration: 200 m²
- Staff room: 100 m²
- Cafeteria: 400 m²
- Health room: 50 m²
```

---

## Detail Level Control (Where AI Shines!)

This is the AI's superpower: architectural knowledge about *what* buildings need. Use keywords to control granularity.

### Level 1: Abstract (Massing / Early Design)

Use for quick massing studies and early stakeholder discussions.

**Keywords:** "abstract", "high-level", "massing", "zones only", "keep it simple", "fat groups"

```
Create an abstract 25,000 m² hotel - major zones only
```

**Result:** 4-6 large groups for easy manipulation
- Guest Rooms (60%)
- Public Areas (15%)  
- Back of House (15%)
- Amenities (10%)

```
Give me a simple mixed-use massing: residential, retail, parking
```

### Level 2: Standard (Schematic Design)

Default level - functional breakdown without excessive detail.

**Keywords:** "standard", "typical", "functional breakdown"

```
Create a 25,000 m² hotel with typical functional breakdown
```

**Result:** 15-25 areas organized into groups
- Guest Rooms: Standard rooms, Suites, Accessible rooms
- Public: Lobby, Restaurant, Bar, Lounge
- Back of House: Kitchen, Laundry, Storage, Staff areas
- Amenities: Pool, Fitness, Spa, Meeting rooms

### Level 3: Detailed (Design Development / Documentation)

Use for detailed programming, contractor briefings, equipment planning.

**Keywords:** "detailed", "comprehensive", "complete breakdown", "itemized", "for documentation"

```
Create a detailed 25,000 m² hotel program for documentation
```

**Result:** 50-100+ specific areas
- Guest Rooms: King rooms (qty), Queen rooms (qty), Suites by type, ADA rooms by type
- F&B: Main kitchen, Prep kitchen, Cold storage, Dry storage, Dish room, Chef office...
- Each area with specific m² and counts

---

## Detail Level Examples by Building Type

### Hotel - All Three Levels

**Abstract:**
```
Abstract 200-room hotel, zones only
```
→ Rooms, Public, BOH, Amenities (4 groups)

**Standard:**
```
200-room hotel with typical breakdown
```
→ Room types, Restaurant, Kitchen, Lobby, Pool, Fitness, Meeting, etc. (~20 areas)

**Detailed:**
```
Detailed 200-room 4-star hotel for programming document
```
→ Every room type, all kitchen stations, each MEP room, all storage types (~80 areas)

### Hospital - Levels Comparison

**Abstract:**
```
Simple hospital massing - 50,000 m²
```
→ Inpatient, Outpatient, Diagnostics, Support, Admin (5 zones)

**Standard:**
```
50,000 m² general hospital, functional breakdown
```
→ ED, ICU, Surgery, Patient floors, Imaging, Labs, Pharmacy, Kitchen, Admin (~25 areas)

**Detailed:**
```
Comprehensive 50,000 m² hospital for equipment planning
```
→ Every OR type, each imaging modality, nurse stations, med rooms, soiled/clean utility per floor (~150 areas)

### School - Levels Comparison

**Abstract:**
```
High-level 500-student school
```
→ Teaching, Resources, Athletics, Admin/Services (4 zones)

**Standard:**
```
500-student elementary school
```
→ Classrooms by grade, Library, Gym, Cafeteria, Admin, Special ed (~20 areas)

**Detailed:**
```
Detailed 500-student school for FFE specification
```
→ Each classroom numbered, specialist rooms, storage closets, janitor rooms, data rooms (~60 areas)

---

## Iterative Refinement Workflow

Start abstract, selectively expand what matters:

```
Step 1: Create abstract 15,000 m² office - major zones only
```
→ Get: Workspace, Support, Core (3 zones)

```
Step 2: Expand the Workspace zone into departments
```
→ Workspace splits into: Sales, Engineering, Executive, Operations

```
Step 3: Detail only the Executive area for the CEO presentation
```
→ Executive expands: C-suite offices, EA stations, Executive boardroom, Private lounge

**Result:** Abstract where you don't care, detailed where you do.

---

## Hybrid Prompts

Mix detail levels in one request:

```
Create 30,000 m² mixed-use:
- Residential: abstract only (just "Apartments")
- Retail: standard breakdown (anchor, inline shops, food court)
- Parking: detailed (each level, ramps, MEP rooms)
```

```
Hotel with:
- Guest floors: standard (room types only)
- Back of house: detailed (all kitchen stations, each storage type)
- Public areas: standard
```

---

## Building Type Knowledge Prompts

Let AI apply industry knowledge:

```
What does a 4-star hotel typically need that a 3-star doesn't?
```

```
Generate a hospital ED sized for 50,000 annual visits
```

```
What's missing from my school program? [with current areas selected]
```

```
Suggest amenities for a Class A office building
```

```
What back-of-house does a 200-seat restaurant need?
```

---

## Tips for Best Results

### ✅ Do

- **Specify total area** when creating programs: "10,000 m² office"
- **Use percentages** for proportional distribution: "30% residential"
- **Use "exactly"** for fixed areas: "exactly 500 m²"
- **Name groups** for auto-organization: "Reception (Public Areas)"
- **Be specific** about ratios: "60/40" or "20%, 30%, 50%"

### ❌ Don't

- Don't calculate exact m² values yourself (let the system do it)
- Don't mix percentage formats: use "20%" or "0.20", not both
- Don't assume existing areas exist - check context first
- Don't use vague quantities: "some offices" → "5 offices at 25 m² each"

### Context Selection

- **Select areas** before asking to split/modify them
- **Select groups** to operate on all members at once
- **Empty selection** = operate on all areas

---

## Consultation Mode

Switch to consultation mode for questions that don't require proposals.

```
What's the typical area per student for a classroom?
```

```
What circulation percentage is standard for hospitals?
```

```
How much parking is needed for 10,000 m² office?
```

```
What's the optimal ceiling height for an art gallery?
```
