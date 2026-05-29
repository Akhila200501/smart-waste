import os
import re
import logging
from database import db

# Configure logging
logger = logging.getLogger("Chatbot")

# A comprehensive knowledge base of detailed articles for our RAG system
KNOWLEDGE_BASE = [
    {
        "id": "kb_plastic",
        "title": "Advanced Plastic Recycling and Circularity",
        "content": """
Plastic waste is one of the most pressing environmental challenges. Plastics are categorized by Resin Identification Codes (RIC) from 1 to 7. 
PET (Code 1, e.g., water bottles) and HDPE (Code 2, e.g., milk jugs) are highly recyclable and widely accepted by curbside programs. 
LDPE (Code 4, plastic bags) and PP (Code 5, bottle caps, yogurt tubs) are increasingly accepted but require specialized recycling facilities. 
PVC (Code 3) and PS (Code 6, Styrofoam) are highly toxic and rarely recycled. 
Under a circular economy framework, mechanical recycling (shredding and melting) is prioritized, while chemical recycling (pyrolysis) is being researched for mixed plastics. 
Recycling plastic reduces oil consumption, keeps microplastics out of our oceans (supporting SDG 14: Life Below Water), and saves approximately 1.5 kg of CO2 per kg of plastic recycled.
        """,
        "tags": ["plastic", "pet", "hdpe", "bottle", "bag", "resin", "ocean", "polymers", "water bottle"]
    },
    {
        "id": "kb_compost",
        "title": "Organic Waste Management and Aerobic Composting",
        "content": """
Organic waste in landfills decomposes anaerobically (without oxygen), producing methane (CH4)—a greenhouse gas 28-36 times more potent than carbon dioxide (CO2). 
Aerobic composting is the natural decomposition of organic materials by microorganisms in an oxygen-rich environment. 
A healthy compost pile requires a carbon-to-nitrogen ratio of roughly 30:1. 'Greens' (nitrogen-rich materials like fruit peels, vegetable scraps, and coffee grounds) must be balanced with 'Browns' (carbon-rich materials like dry leaves, cardboard, sawdust, and straw). 
Proper moisture levels (like a wrung-out sponge) and regular turning for aeration are critical to prevent odor and speed up decomposition. 
Composting directly addresses SDG 13 (Climate Action) and SDG 15 (Life on Land) by converting waste into nutrient-rich humus, improving soil water retention, and eliminating the need for chemical fertilizers.
        """,
        "tags": ["organic", "compost", "food", "waste", "leaves", "methane", "soil", "scraps", "fertilizer", "banana", "apple"]
    },
    {
        "id": "kb_metal",
        "title": "Metal Recycling and Energy Conservation",
        "content": """
Metals are highly valuable and can be recycled indefinitely without degradation of their material properties. 
Aluminum recycling (e.g., soda cans) is exceptionally efficient, requiring 95% less energy than producing primary aluminum from bauxite ore. 
Steel and iron are magnetic and are easily sorted in recovery plants using electromagnets. Steel recycling saves 60% to 75% of the energy compared to virgin production. 
Rinsing cans and removing plastic wraps are crucial step in preparation. 
Recycling metals prevents habitat destruction caused by open-pit mining, conserves mineral resources, and dramatically reduces carbon emissions, aligning perfectly with SDG 12 (Responsible Consumption and Production) and SDG 13 (Climate Action).
        """,
        "tags": ["metal", "aluminum", "can", "steel", "iron", "soda can", "energy", "mining", "alloy", "tin"]
    },
    {
        "id": "kb_glass",
        "title": "Glass Circular Economy and Infinite Recycling",
        "content": """
Glass is 100% recyclable and can be recycled endlessly. It is made from abundant natural materials like silica sand, soda ash, and limestone. 
When recycled, glass is crushed into 'cullet,' which melts at a much lower temperature than raw materials. This reduces energy consumption by 2-3% for every 10% of cullet used, lowering greenhouse gas emissions. 
However, non-container glass—such as mirrors, window glass, Pyrex (borosilicate glass), and light bulbs—contains chemical additives and has different melting points. 
Mixing these into container glass recycling ruins entire batches. Bottles and jars should be rinsed and sorted by color (clear, green, brown) if required locally. 
Glass recycling reduces landfill accumulation and sand mining in delicate river ecosystems, supporting SDG 11 (Sustainable Cities) and SDG 12 (Responsible Consumption).
        """,
        "tags": ["glass", "bottle", "jar", "cullet", "sand", "silica", "pyrex", "mirror", "melting"]
    },
    {
        "id": "kb_ewaste",
        "title": "Electronic Waste (E-waste) and Rare Metal Recovery",
        "content": """
E-waste (electronic waste) is the fastest-growing waste stream globally. Electronics contain hazardous substances like lead, cadmium, mercury, and flame retardants, which can leach into groundwater if landfilled, posing severe public health risks. 
At the same time, electronics contain valuable precious metals, including gold, silver, copper, platinum, and cobalt. 
E-waste should never be placed in household trash bins. Instead, it must be taken to authorized e-waste collection centers or manufacturer take-back kiosks. 
Certified e-waste recyclers dismantle the products, safely capture hazardous elements, and extract precious resources, reducing the demand for mining raw ores. 
Responsible e-waste disposal is vital for SDG 12 (Responsible Consumption) and SDG 3 (Good Health and Well-being).
        """,
        "tags": ["e-waste", "electronics", "battery", "phone", "computer", "lead", "mercury", "circuit", "gold", "charger"]
    },
    {
        "id": "kb_sdg_overview",
        "title": "Waste Management and the United Nations SDGs",
        "content": """
Sustainable waste management is a key cornerstone for achieving several United Nations Sustainable Development Goals (SDGs) by 2030. 
First, SDG 11 (Sustainable Cities and Communities) targets a reduction in the environmental impact of cities by improving municipal waste collection. 
Second, SDG 12 (Responsible Consumption and Production) explicitly aims to substantially reduce waste generation through prevention, reduction, recycling, and reuse. 
Third, SDG 13 (Climate Action) benefits directly from waste diversion: reducing food waste and composting mitigates methane emissions from landfills, while recycling industrial materials reduces energy-intensive manufacturing. 
Fourth, SDG 14 (Life Below Water) focuses on ending marine plastic litter, which harms coral reefs and marine life. 
Finally, SDG 15 (Life on Land) is supported by reducing soil pollution and stopping ecological devastation caused by landfills and mining operations.
        """,
        "tags": ["sdg", "sustainability", "climate", "un", "responsible", "cities", "water", "marine", "landfill"]
    },
    {
        "id": "kb_zerowaste",
        "title": "The Zero Waste Hierarchy and Circular Living",
        "content": """
The Zero Waste Hierarchy expands on the traditional '3 Rs' to offer a comprehensive guide for circular living. It prioritizes actions in the following order: 
1. Refuse: Say no to single-use plastics, packaging, and items you do not need. 
2. Reduce: Decrease the amount of consumption and buy durable goods. 
3. Reuse: Repair, repurpose, and share items rather than buying new ones. 
4. Recycle: Process waste materials into new products (mechanical or chemical processing). 
5. Rot: Compost organic matter to enrich the soil. 
Adopting a zero-waste lifestyle means designing out waste at the source and treating all discarded products as valuable resources, preventing waste from entering landfills, incinerators, or oceans.
        """,
        "tags": ["zero waste", "reduce", "reuse", "recycle", "refuse", "rot", "circular", "lifestyle", "shopping"]
    }
]

def search_knowledge_base(query: str):
    """
    Simple keyword-based retrieval engine that matches queries against 
    knowledge base article titles, content, and tags, returning ranked matches.
    """
    query_words = re.findall(r'\w+', query.lower())
    scored_articles = []
    
    for article in KNOWLEDGE_BASE:
        score = 0
        title_lower = article["title"].lower()
        content_lower = article["content"].lower()
        
        for word in query_words:
            # Check title matches (higher weight)
            if word in title_lower:
                score += 5
            # Check tag matches (medium weight)
            for tag in article["tags"]:
                if word == tag or word in tag:
                    score += 3
            # Check content matches (lower weight)
            if word in content_lower:
                score += 1
                
        if score > 0:
            scored_articles.append((score, article))
            
    # Sort by score descending
    scored_articles.sort(key=lambda x: x[0], reverse=True)
    
    # Return top 2 articles, or a default overview if no matches
    if not scored_articles:
        return [KNOWLEDGE_BASE[5]] # Fallback to SDG overview
        
    return [art for score, art in scored_articles[:2]]

def generate_sustainability_response(query: str, retrieved_articles: list) -> str:
    """
    Emulate an IBM Granite LLM response trained on sustainability.
    Uses the retrieved RAG context to compile a professional, detailed, 
    markdown-formatted response.
    """
    query_lower = query.lower()
    
    # Build context string
    context_str = "\n\n".join([f"Source [{a['title']}]: {a['content'].strip()}" for a in retrieved_articles])
    
    # Draft answer using knowledge base and templates
    response_header = "### 🌿 IBM Granite RAG Sustainability Engine\n\n"
    
    # Determine the context structure based on the query type
    main_article = retrieved_articles[0]
    
    introduction = f"Based on your query regarding *\"{query}\"*, I retrieved relevant information from my sustainability knowledge base, primarily referencing **{main_article['title']}**.\n\n"
    
    # Generate structured output based on question topics
    body = ""
    
    if "plastic" in query_lower or "bottle" in query_lower or "bag" in query_lower:
        body = """
#### ♻️ Plastic Recycling Protocol:
Plastics should be recycled systematically using the following guidelines:
1. **Identify the Resin Code**: Check the triangular symbol on the bottom of the container. 
   - **PET (Code 1)** and **HDPE (Code 2)** are highly recyclable. 
   - **PP (Code 5)** (caps, tubs) is widely accepted but check local guidelines.
2. **Wash and Clean**: Empty liquids and scrape out any food remnants. A quick rinse saves an entire batch of plastics from being rejected due to contamination.
3. **Consolidate Caps**: Keep plastic caps attached to their bottles as small items frequently jam machinery in sorting plants.
4. **Avoid Soft Plastics**: Thin plastic bags, cling wraps, and bubble wraps should *never* go into standard curbside recycling bins. Instead, drop them off at dedicated supermarket collection points.

#### 🌍 SDG Impact:
By recycling this plastic, you are directly supporting **SDG 12 (Responsible Consumption)** and **SDG 14 (Life Below Water)** by preventing plastic debris from disintegrating into toxic microplastics that threaten marine lifecycles.
        """
    elif "compost" in query_lower or "organic" in query_lower or "food" in query_lower or "peel" in query_lower:
        body = """
#### 🍂 Aerobic Composting Blueprint:
To convert organic waste into nutrient-dense compost instead of toxic landfill methane:
1. **Maintain the Carbon-to-Nitrogen Balance (30:1)**:
   - **Greens (Nitrogen-rich)**: Fruit peels, vegetable scraps, green leaves, coffee grounds, and tea bags.
   - **Browns (Carbon-rich)**: Dry leaves, branches, shredded paper, un-greasy cardboard, and straw.
2. **Control Moisture**: Ensure the compost pile is damp but not soaked (similar to a wrung-out sponge).
3. **Aeration**: Turn the pile with a fork every 2 to 3 weeks. Oxygen is essential for aerobic bacteria to decompose materials efficiently without producing bad odors.
4. **Avoid Contaminants**: Do not add dairy, meat, bones, pet wastes, or weeds, which can attract pests or harbor diseases.

#### 🌍 SDG Impact:
Diverting food waste to compost directly reduces carbon/methane emissions, advancing **SDG 13 (Climate Action)** and restoring soil microbiology under **SDG 15 (Life on Land)**.
        """
    elif "metal" in query_lower or "can" in query_lower or "aluminum" in query_lower or "steel" in query_lower:
        body = """
#### 🥫 Metal Recycling and Energy Saving Guide:
Metals can be recycled infinitely with zero structural degradation.
1. **Rinse Thoroughly**: Ensure food tins or soda cans are completely free from residue.
2. **The Magnet Test**: Steel and tin cans are magnetic; aluminum cans are not. This helps sorting centers easily isolate them.
3. **Handle Aerosols Safely**: Spray cans must be 100% empty before recycling. Do not crush them as they might explode.
4. **Separate Lids**: Separate loose metal lids and slide them inside steel cans, then pinch the top of the can to keep them inside.

#### 🌍 SDG Impact:
Aluminum recycling requires **95% less energy** than extraction from raw bauxite ore, making this action one of the most effective ways to lower greenhouse gases (**SDG 13: Climate Action**).
        """
    elif "glass" in query_lower or "jar" in query_lower:
        body = """
#### 🍾 Glass Recycling and Circularity:
Glass is infinitely recyclable. Here is the correct handling procedure:
1. **Keep it Container-only**: Only recycle glass jars and bottles.
2. **Exclude Contaminants**: *Do not* include Pyrex, drinking glasses, mirrors, windshields, or light bulbs. These are made with special chemical formulations and melt at different temperatures, ruining recycling batches.
3. **Rinse and Sort**: Empty all contents. Sort by color (brown, green, clear) if your local recycling system requests color sorting.
4. **Remove Metal Lids**: Separate metal lids and caps, recycling them in the metal bin.

#### 🌍 SDG Impact:
Using recycled glass (cullet) reduces carbon emissions and prevents sand mining, protecting fragile riverbed habitats and advancing **SDG 11 (Sustainable Cities)** and **SDG 12**.
        """
    elif "e-waste" in query_lower or "battery" in query_lower or "phone" in query_lower or "electronics" in query_lower:
        body = """
#### 🔌 Safe E-waste and Battery Disposal Protocol:
Electronic waste should *never* enter municipal trash streams due to high chemical toxicity.
1. **Separate Rechargeable Batteries**: Lithium-ion, NiMH, and lead-acid batteries are highly flammable and represent severe fire hazards in collection trucks. Keep them separate.
2. **Use Specialized Depots**: Take electronics to local hardware stores, hazardous waste facilities, or designated electronics recycling kiosks.
3. **Wipe Personal Data**: Perform a factory reset on smartphones, tablets, and hard drives before drop-off.
4. **Manufacturer Take-Back Programs**: Many electronics brands offer free recycling mail-in programs or in-store drop-offs.

#### 🌍 SDG Impact:
Recovering gold, silver, and copper from old circuit boards prevents massive landscape destruction from open-pit mining operations, directly supporting **SDG 12 (Responsible Consumption)**.
        """
    else:
        # Generic comprehensive circular economy response
        body = f"""
#### 🔄 The 5 R's Zero-Waste Blueprint:
To transition toward a circular economy as outlined in *{main_article['title']}*, try to practice these core actions in order:
1. **Refuse**: Decline single-use plastics, plastic bags, and excessive packaging.
2. **Reduce**: Lower your daily consumption and purchase high-durability items.
3. **Reuse**: Repair old electronics, repurpose jars, and donate items you no longer use.
4. **Recycle**: Clean and separate packaging materials (paper, metal, plastic, glass).
5. **Rot**: Set up a home composting bin to divert food waste from landfill methane emissions.

#### 📋 Retrieved Context:
*\"{main_article['content'].strip()[:200]}...\"*
        """
        
    sources_section = f"\n\n---\n#### 🔍 Retrieved RAG References:\n"
    for idx, art in enumerate(retrieved_articles):
        sources_section += f"- **Source {idx+1}**: {art['title']} *(Tags: {', '.join(art['tags'][:4])})*\n"
        
    return response_header + introduction + body + sources_section

def query_rag_chatbot(user_id: int, query: str) -> str:
    """
    Main entry point for the RAG chatbot. Retrieves articles,
    generates a professional, structured response, and saves the interaction
    to the chat history database.
    """
    logger.info(f"Querying RAG Chatbot: '{query}' for user {user_id}")
    
    # 1. Retrieve most relevant articles
    retrieved_articles = search_knowledge_base(query)
    
    # 2. Generate detailed response
    response = generate_sustainability_response(query, retrieved_articles)
    
    # 3. Log to DB
    try:
        db.log_chat_message(user_id, query, response)
    except Exception as e:
        logger.error(f"Error logging chat message: {e}")
        
    return response
